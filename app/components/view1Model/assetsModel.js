'use strict';

angular.module('myApp.view1')
.service("assetsModel", ['$rootScope', '$http', '$timeout', '_', 'stateModel',
  function ($rootScope, $http, $timeout, _, stateModel) {
    var this_ = this;

    // cached data
    this.data = [];
    this.sizes = {};
    this.stateModel = stateModel;

    this.reset = function() {
      this_.data = [];
      this_.sizes = {};
    };

    // get the known file state
    this.update = function (root, callback) {
      var more = function (id, cb) {
        $http.get('/scan?iteratorid=' + id).then(
          function success(result) {

            // recurse until resource is exhausted
            if (result.data.length)
            {
              result.data.forEach(function (item) {
                // add to sizes dictionary to easily spot duplicates
                if (!this_.sizes[item.size])
                {
                  this_.sizes[item.size] = [];
                }

                if (this_.sizes[item.size].indexOf(item.path) < 0)
                {
                  this_.sizes[item.size].push(item.path);
                }

                // add to main data set
                if (!_.find(this_.data, function(x) {
                  // integer compare should be faster than string?
                  return item.size == x.size && item.path == x.path;
                }))
                {
                  this_.data.push(item);
                }
              });

              // tell the world we have new assets
              $rootScope.$broadcast('assets:updated', result.data);

              // ask for the next batch
              if (!this_.stateModel.current.transient.cancel)
              {
                $timeout(more, 0, false, id, cb);
              }
              else
              {
                cb('cancel');
              }
            }
            else
            {
              cb(null);
            }
          },
          function error(err) {
            cb(err);
          });
      };

      // incrementally update the data
      var postUrl = '/scan?root=' + root;
      $http.post(postUrl, this_.stateModel.get_enabled_extensions()).then(
        function success(id_result) {
          var id = id_result.data['iteratorid'];
          more(id, function (err) {
            // inform user
            if (err)
            {
              $rootScope.$broadcast('error', err);
            }

            callback();
          });
        },
        function error(err) {
          callback(err);
        });

    };
  }
])
