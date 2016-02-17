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
      self.folders_ = map(lambda name: {"name": name, "path": winshell.folder(name)}, CSIDLs)

    exposed = True

    @cherrypy.tools.json_out()
    def GET(self):
        return self.folders_

class Scan(object):
  # TODO: accept override value as query param
  chunk_size = 100    # return 100 hits at a time

  # cache of generators
  generators = {}

  def __init__(self):
    pass

  exposed = True

  # POST starts the scan process by accepting extensions
  # and returning the iteratorid to use in subsequent GET calls
  @cherrypy.tools.json_in()
  @cherrypy.tools.json_out()
  def POST(self, root):
    # generate a new one
    extensions = cherrypy.request.json
    iterator = utils.scan(root, extensions)
    iteratorid = str(id(iterator))
    self.generators[iteratorid] = iterator

    # return iteratorid on first call
    return {"iteratorid": iteratorid}

  # must be called with an interator ID returned from a previous POST call
  @cherrypy.tools.json_out()
  def GET(self, iteratorid):

    # iteratorid provided - retrieve the iterator
    if iteratorid in self.generators:
      iterator = self.generators[iteratorid]
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
      del self.generators[iteratorid]

    return result

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
      result.append({"hash": hash, "path": p});

    return result

class Root(object):
  folders = Folders()
  scan = Scan()
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
