'use strict';

angular.module('myApp.view1')
.service("digestsModel", ['$rootScope', '$http', '$timeout', '_', 'assetsModel',
  function ($rootScope, $http, $timeout, _, assetsModel) {
    var this_ = this;

    this_.reset = function () {
      this_.digest_path_map = {};
      this_.path_size_map = {};
      this_.digestedCount = 0;
    };
    this_.reset();

    var getDigests = function (paths) {
      $http.post("/digest", paths)
        .success(function (data, status, headers, config) {
          // merge with existing digests
          data.forEach(function (item) {
            this_.digestedCount += 1;
            if (!this_.digest_path_map[item.hash])
            {
              this_.digest_path_map[item.hash] = [];
            }
            this_.digest_path_map[item.hash].push(item.path);

            // keep track of sizes too for analysis
            if (!this_.path_size_map[item.path])
            {
              this_.path_size_map[item.path] = item.size;
            }
            else
            {
              // why are we calculating the digest twice?
              $rootScope.$broadcast('error', 'calculating digest twice for path: ' + item.path);
            }
          });

          $rootScope.$broadcast('digests:updated', this_.digest_path_map);
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
