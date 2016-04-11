import os
import cherrypy
import ctypes
import winshell

from dedup import utils


"""
Get the list of interesting folders
"""
class Folders(object):
    def __init__(self):
      CSIDLs = ["mypictures", "common_pictures", "myvideo", "common_video", "personal"]
      self.folders_ = [{"name": name, "path": winshell.folder(name)} for name in CSIDLs]

    exposed = True

    @cherrypy.tools.json_out()
    def GET(self):
        return self.folders_

# cache of generators
generators = {}

class Continue(object):
  # TODO: accept override value as query param
  chunk_size = 100    # return 100 hits at a time

  def __init__(self):
    pass

  exposed = True

  # must be called with an interator ID returned from a previous POST call
  @cherrypy.tools.json_out()
  def GET(self, iteratorid):

    # iteratorid provided - retrieve the iterator
    if iteratorid in generators:
      iterator = generators[iteratorid]
    else:
      raise cherrypy.HTTPError(400)

    # return some portion of the data
    remaining = self.chunk_size
    result = []
    for hit in iterator:
      remaining -= 1
      result.append(hit)
      if remaining <= 0:
        break

    if not len(result):
      # content exhausted
      # discard the single-use generator
      del generators[iteratorid]

    return result

class Scan(object):
  # TODO: accept override value as query param
  chunk_size = 100    # return 100 hits at a time

  # cache of generators
  generators = {}

  def __init__(self):
    pass

  exposed = True

  # PUT starts the scan process by accepting extensions
  # and returning the iteratorid to use in subsequent GET calls
  @cherrypy.tools.json_in()
  @cherrypy.tools.json_out()
  def PUT(self, root):
    # generate a new one
    extensions = cherrypy.request.json
    iterator = utils.scan(root, extensions)
    iteratorid = str(id(iterator))
    generators[iteratorid] = iterator

    # return iteratorid on first call
    return {"iteratorid": iteratorid}

class Digest(object):
  exposed = True

  @cherrypy.tools.json_in()
  @cherrypy.tools.json_out()
  def POST(self):
    paths = cherrypy.request.json
    result = []

    # calculate the sha256 digests of the given paths
    for p in paths:
      hash = utils.digest(p)
      size = os.stat(p).st_size
      result.append({"hash": hash, "path": p, "size": size});

    return result

class Root(object):
  folders = Folders()
  scan = Scan()
  scan.__dict__["continue"] = Continue()
  digest = Digest()

if __name__ == '__main__':
  config = {
        "/": {
           #  "tools.staticdir.debug": True,
          "tools.staticdir.index": "index.html",
          "tools.staticdir.on": True,
          "tools.staticdir.dir": os.path.join(os.getcwd(), "app"),
          "request.dispatch": cherrypy.dispatch.MethodDispatcher()
          }
        }

  cherrypy.quickstart(Root(), config=config)
