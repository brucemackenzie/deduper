'use strict';

angular.module('myApp.view1', ['ngRoute', 'ngResource', 'webStorageModule',
  'ui.grid.resizeColumns', 'ui.grid', 'underscore', 'ui.grid.selection'])
.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])
.filter('prettyDate', function() {
  return function(input) {
    // convert to date object
    var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
    d.setUTCSeconds(input);
    return d.toISOString();
  };
})
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
])
.controller('View1Ctrl', ['$rootScope', '$scope', 'uiGridConstants', '_',
  'stateModel', 'assetsModel', 'digestsModel',
  function ($rootScope, $scope, uiGridConstants, _, stateModel, assetsModel, digestsModel) {

    // transient UI state
    $scope.stateModel = stateModel;
    $scope.assetsModel = assetsModel;
    $scope.digestsModel = digestsModel;

    $scope.reset = function() {
      $scope.stateModel.current.transient.busy = false;
      $scope.stateModel.current.transient.cancel = false;
      $scope.duplicates = [];
      $scope.digestsModel.reset();
      $scope.assetsModel.reset();
      $scope.msg = 'no messages';
    };
    $scope.reset();

    $scope.resetButtonClicked = function() {
      $scope.reset();
    };

    $scope.actionButtonClicked = function() {
      if ($scope.stateModel.current.transient.busy)
      {
        // cancel
        $scope.stateModel.current.transient.cancel = true;
      }
      else
      {
        $scope.reset();
        $scope.refreshAssets();
      }
    };

    // trigger an update of the assets model
    $scope.refreshAssets = function () {

      // open the files accordion
      $scope.stateModel.current.accordion[1].open = true;

      var folders = $scope.stateModel.get_enabled_folders();
      if (folders.length)
      {
        $scope.stateModel.current.transient.busy = true;
        async.each(folders,
          function(folder, callback) {
            if ($scope.stateModel.current.transient.cancel)
            {
              callback('cancel');
            }
            else
            {
              assetsModel.update(folder, function(err) {
                callback(err);
              });
            }
          },
          function(err) {
            $scope.stateModel.current.transient.busy = false;
            $scope.stateModel.current.transient.cancel = false;
          });
      }
    };

    // react to assetsModel update
    $scope.$on('assets:updated', function (event, data) {
      //$scope.assets = assetsModel.data;
    });

    // react to assetsModel update
    $scope.$on('digests:updated', function (event, data) {

      // merge digest into duplicates array
      var merge = function (digested) {
        var index = $scope.duplicates.findIndex(function (item, i) {
          return (item.hash == digested.hash);
        });

        if (index >= 0)
        {
          // already exists so merge
          digested.paths.forEach(function(new_path) {
            var path_index = $scope.duplicates[index].paths.indexOf(new_path);
            if (path_index < 0)
            {
              // not found so insert
              $scope.duplicates[index].paths.push(new_path);
            }
          });
        }
        else
        {
          // new item
          $scope.duplicates.push(digested);
        }
      };

      // update duplicates array with new information
      for (var d in $scope.digestsModel.digests)
      {
        if ($scope.stateModel.current.transient.cancel)
        {
          break;
        }

        // any duplicates?
        if ($scope.digestsModel.digests[d].length > 1)
        {
          merge({ hash: d, paths: $scope.digestsModel.digests[d] });
        }
      }
    });

    $scope.$on('error', function (event, data) {
      $scope.msg = data;
    });

    $scope.gridOptionsAssets = {
      enableSorting: true,
      showColumnFooter: true,
      columnDefs: [
        { name: 'date',
          cellTemplate: '<div class="ui-grid-cell-contents" title="TOOLTIP">{{row.entity.date | prettyDate}}</div>' },
        { name: 'path', type: 'string',
          aggregationType: uiGridConstants.aggregationTypes.count
        },
        {
          name: 'size', type: 'number',
          aggregationType: uiGridConstants.aggregationTypes.sum
        }
      ],
      data: "assetsModel.data"
    };

    $scope.gridOptionsFolders = {
      enableSorting: true,
      columnDefs: [
        { name: 'path' }
      ],
      data: "stateModel.current.folders",
      onRegisterApi: function(gridApi){
        //set gridApi on scope
        $scope.gridOptionsFolders.gridApi = gridApi;

        // attach the handlers
        gridApi.grid.registerDataChangeCallback(function() {
          // sync the ui state with the object state
          $scope.gridOptionsFolders.gridApi.grid.rows.forEach(
            function(row) {
              if (row.entity.enabled)
              {
                $scope.gridOptionsFolders.gridApi.selection.selectRow(row.entity);
              }
            }
          );
        });

        gridApi.selection.on.rowSelectionChanged($scope, function(row){
          row.entity.enabled = row.isSelected;
          $scope.stateModel.save_state();
        });

        gridApi.selection.on.rowSelectionChangedBatch($scope, function(rows){
          rows.forEach(function(row) {
            row.entity.enabled = row.isSelected;
          });
          $scope.stateModel.save_state();
        });
      }
    };

    $scope.gridOptionsExt = {
      enableSorting: true,
      enableSelection: true,
      columnDefs: [
        { name: 'extension', field: 'name' }
      ],
      data: "stateModel.current.extensions",
      onRegisterApi: function(gridApi){
        $scope.gridOptionsExt.gridApi = gridApi;

        gridApi.grid.registerDataChangeCallback(function() {
          // sync the ui state with the object state
          $scope.gridOptionsExt.gridApi.grid.rows.forEach(
            function(row) {
              if (row.entity.enabled)
              {
                $scope.gridOptionsExt.gridApi.selection.selectRow(row.entity);
              }
            }
          );
        });

        gridApi.selection.on.rowSelectionChanged($scope, function(row){
          row.entity.enabled = row.isSelected;
          $scope.stateModel.save_state();
        });

        gridApi.selection.on.rowSelectionChangedBatch($scope, function(rows){
          rows.forEach(function(row) {
            row.entity.enabled = row.isSelected;
          });
          $scope.stateModel.save_state();
        });
      }
    };

    $scope.gridOptionsDuplicates = {
      enableSorting: true,
      showColumnFooter: true,
      columnDefs: [
        { name: 'paths' }
      ],
      data: "duplicates"
    };

    // restore UI state from local storage
    stateModel.load_state();
  }
]);
