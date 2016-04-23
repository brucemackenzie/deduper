//var aws = require('aws-sdk');

var restify = require('restify');
var fs = require("fs");
var path = require("path");
var crypto = require('crypto');
var async = require('async');

var server = restify.createServer({
  name: 'deduper',
  version: '0.0.1'
});

// iterators
server.state = {
  chunk_size: 100,
  generators: {}
};

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

// credit: http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
function makeIterator(root, extensions){
  var nextIndex = 0;
  var extensions = extensions;
  var q = [];
  var list = [];  // current folder
  var dir;        // current dir

  // prime the queue
  q.push(root);

  return {
     next: function() {
       while (true)
       {
         if (list.length == 0)
         {
           if (q.length > 0)
           {
             dir = q.shift(); // take first item
             list = fs.readdirSync(dir);
           }

           if (list.length == 0)
           {
             // list exhausted, and queue empty
             return {done: true};
           }
        }

        // list guaranteed to have a value here
        var file = list.shift();
        file = dir + '/' + file;

        // ignore permission errors
        var stat;
        try
        {
          stat = fs.statSync(file);
          if (!stat)
          {
            continue;
          }
        }
        catch (e)
        {
          continue;
        }

        if (stat.isDirectory())
        {
          q.push(file);
        }
        else
        {
          // apply extension filter
          // ignore the leading '.' in ''.jpg'
          var ext = path.extname(file).substr(1).toLowerCase();
          if (extensions.indexOf(ext) >= 0)
          {
            var dt = new Date(stat.mtime);
            var result = { "path":file, "size":stat.size, "date":dt.getTime() };
            return {value: result, done: false};
          }
        }
      }
    } // next()
  }
}

// calculate the hash of the resource described by the path p
function digest(p, cb) {
  try {
    var s = fs.createReadStream(p, {flags: 'r', autoClose: true});
    var hash = crypto.createHash('sha256');
    hash.setEncoding('hex');

    s.on('end', function() {
        hash.end();
        cb(null, hash.read());
    });

    // read all file and pipe it (write it) to the hash object
    s.pipe(hash);
  } catch (e) {
    cb(e);
  }
};

// protocol for scan
// 1. call /scan with root and extensions
//    server returns iteratorid
// 2. call /scan/continue with iteratorid
//    server sends back up to N results
// 3. optionally repeat 2 as many times as needed
server.put('/scan', function (req, res, next) {

  // extensions array in JSON payload
  var iteratorid = ((new Date).getTime()).toString(10);
  var root = req.query.root;

  // prime the iterator
  var iterator = makeIterator(root, req.body);
  server.state.generators[iteratorid] = iterator;
  res.send({"iteratorid": iteratorid});
  return next();
});

server.get('/scan/continue', function (req, res, next) {
  // array of { "path":filepath, "size":s.st_size, "date":s.st_mtime }
  var results = [];

  var iterator = server.state.generators[req.params.iteratorid];
  if (iterator)
  {
    for (var i = 0; i < server.state.chunk_size; i++)
    {
      var file_path = iterator.next().value;
      if (file_path)
      {
        results.push(file_path);
      }
      else
      {
        delete server.state.generators[req.params.iteratorid];
        break;
      }
    }
  }

  // iterator or exhausted - same answer
  res.send(200, results);

  return next();
});

server.post('/digest', function (req, res, next) {
  // digest the resources defined by the given paths
  var paths = req.body;
  var limit = 10; // simultaneous digests

  async.mapLimit(paths, limit,
    function(item, callback) {
      try
      {
        var stat = fs.statSync(item);
        digest(item, function(err, hash) {
          callback(null, {"hash": hash, "path": item, "size": stat.size});
        });
      }
      catch (e) {
        callback(null, {"error": e.message});
      }
    },
    function(err, results){
      res.send(200, results);
      return next();
    });
});

server.get('/folders', function (req, res, next) {
  res.send(200, [{"name":"home", "path":process.env.USERPROFILE}]);
  return next();
});

server.get('/image/:path', function(req, res, next) {
  // try to open the file and stream it back
  try
  {
    var name = req.params.path;
    fs.createReadStream(name).pipe(res);
  }
  catch(e)
  {
    res.send(400, req.params.path);
  }

  return next();
});

server.on('InternalServer', function (req, res, err, cb) {
  err.body = 'something is wrong!';
  return cb();
});

// static
server.get(/\/?.*/, restify.serveStatic({
  directory: '../app',
  default: 'index.html'
}));

// only accept local requests because we are serving up local files without restriction
server.pre(function(req, res, next) {
  var ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
  if (ip != '127.0.0.1' && ip != "localhost") 
  {
    return res.end();
  }
  return next();
});

// force ipv4
server.listen(8080, "127.0.0.1", function () {
  console.log('%s listening at %s', server.name, server.url);
});
