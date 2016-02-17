from os import walk, remove, stat, listdir
from os.path import join as joinpath, expanduser, isfile, getmtime, normpath
import hashlib

"""
generate the filesizes for every matching file
example: ['jpg', 'bmp', 'png', 'gif']
"""
def scan(rootdir, extensions):
  for path, dirs, files in walk( unicode(rootdir) ):
    # restrict to filenames that match current extensions
    file_names = [fn for fn in files
      if any(fn.lower().endswith(ext) for ext in extensions)]

    for filename in file_names:
      filepath = normpath(joinpath( path, filename ))
      s = stat(filepath)
      yield { "path":filepath, "size":s.st_size, "date":s.st_mtime }

"""
incrementally calculate a digest hash for the given file
"""
def digest(filepath):
  blocksize = 65536
  hasher = hashlib.sha256()
  with open( filepath, 'rb' ) as openfile:
    buf = openfile.read(blocksize)
    while len(buf) > 0:
        hasher.update(buf)
        buf = openfile.read(blocksize)

    return hasher.hexdigest()
