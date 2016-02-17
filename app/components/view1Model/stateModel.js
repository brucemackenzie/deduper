'use strict';

angular.module('myApp.view1')
.service("stateModel", ['$rootScope', '$http', '$timeout', '$resource', '_', 'webStorage',
  function ($rootScope, $http, $timeout, $resource, _, storage) {
    var this_ = this;
    var stateKey = 'deduper.ui-state';
    this_.current = {
      transient: {}
    };

    this_.get_default_folders = function(cb) {
      $resource('/folders').query().$promise.then(
        function success(result) {
          cb(null, result);
        },
        function error(err) {
          cb(err);
        });
    };

    this_.get_default_extensions = function(cb) {
      cb(null, ['jpg', 'jpeg', 'bmp', 'nef', 'raw', 'png', 'mov', 'mts']);
    };

    this_.get_enabled_extensions = function() {
      // return array of enabled extensions
      return _.map(_.filter(this_.current.extensions,
        function(x) {
          return x.enabled;
        }),
        function(item) {
          return item.name;
        });
    };

    this_.get_enabled_folders = function() {
      // return array of enabled extensions
      return _.map(_.filter(this_.current.folders,
        function(x) {
          return x.enabled;
        }),
        function(item) {
          return item.path;
        });
    };

    /**
     * load state from local storage, or create defaults
    */
    this_.get_state = function(cb) {
      if (storage.has(stateKey))
      {
        cb(null, storage.get(stateKey));
      }
      else
      {
        var state = {
          transient: {},
          accordion: [{open: false}, {open:false}, {open:false}]
        };

        var tasks = [
          function(callback) {
            this_.get_default_folders(function(err, default_folders) {
              var result = { folders:[] };
              if (!err)
              {
                default_folders.forEach(function(ext) {
                  result.folders.push({"enabled": true, "path": ext.path});
                });
              }
              callback(err, result);
            });
          },
          function(callback) {
            this_.get_default_extensions(function(err, default_extensions) {
              var result = { extensions:[] };
              if (!err)
              {
                default_extensions.forEach(function(ext) {
                  result.extensions.push({"enabled": true, "name": ext});
                });
              }
              callback(err, result);
            });
          }
        ];

        // trigger the tasks
        async.parallel(tasks, function(err, results) {
          // transfer results to state
          results.forEach(function(result) {
            for(var f in result)
            {
              if (result.hasOwnProperty(f))
              {
                state[f] = result[f];
              }
            }
          });

          cb(err, state);
        });
      }
    };

    this_.load_state = function() {
      this_.get_state(function(err, state) {
        this_.current = state;
      });
    };

    this_.save_state = function() {
       // never persist transient state
      var temp = JSON.parse(JSON.stringify(this_.current));
      temp.transient = {};
      storage.set(stateKey, temp);
    };
  }
]);
