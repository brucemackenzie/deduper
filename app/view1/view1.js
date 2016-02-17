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
