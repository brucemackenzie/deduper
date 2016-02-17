'use strict';

angular.module('myApp.view1')
.service("digestsModel", ['$rootScope', '$http', '$timeout', '_', 'assetsModel',
  function ($rootScope, $http, $timeout, _, assetsModel) {
    this.digests = {};
    var this_ = this;

    this.reset = function () {
      this.digests = {};
    };

    var getDigests = function (paths) {
      $http.post("/digest", paths)
        .success(function (data, status, headers, config) {
          // merge with existing digests
          data.forEach(function (item) {
            if (!this_.digests[item.hash])
            {
              this_.digests[item.hash] = [];
            }
            this_.digests[item.hash].push(item.path);
          });

          $rootScope.$broadcast('digests:updated', this_.digests);
        })
        .error(function (data, status, headers, config) {
          $rootScope.$broadcast('error', status);
        });
    };

    // react to assetsModel update
    $rootScope.$on('assets:updated', function (event, data) {
      // calculate the digest values of any files sharing a file size
      var new_paths = _.map(data, function (item) { return item.path; });
      for (var key in assetsModel.sizes)
      {
        // multiple files with the same size?
        if (assetsModel.sizes[key].length > 1)
        {
          // request digest calculation for each new file
          var to_digest = _.intersection(assetsModel.sizes[key], new_paths);
          if (to_digest.length) {
            getDigests(to_digest);
          }
        }
      }
    });
  }
]);
