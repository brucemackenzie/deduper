'use strict';

angular.module('myApp.view1', ['ngRoute', 'ngResource', 'webStorageModule',
  'ui.grid.resizeColumns', 'ui.grid', 'underscore', 'ui.grid.selection',
  'ui.grid.edit', 'ui.grid.cellNav'])
.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])
.filter('prettyDate', function() {
  return function(input) {
    // convert seconds to date object
    var d = new Date(input);
    return d.toISOString();
  };
})
.filter('asUnit', function() {
  return function(input) {
    if (!input)
    {
      return 0;
    }

    var scales = [
      {val: 1, max: Math.pow(2,10)-1, unit: 'byte'},
      {val: Math.pow(2,10), max: Math.pow(2,20)-1, unit: 'kB'},
      {val: Math.pow(2,20), max: Math.pow(2,30)-1, unit: 'MB'},
      {val: Math.pow(2,30), max: Math.pow(2,40)-1, unit: 'GB'},
      {val: Math.pow(2,40), max: Math.pow(2,50)-1, unit: 'TB'},
    ];

    var scale = scales[scales.length - 1];
    for (var i = 0; i < scales.length; i++)
    {
      if (input < scales[i].max)
      {
        scale = scales[i];
        break;
      }
    }

    // return appropriate string
    return (input/scale.val).toFixed(1) + scale.unit;;
  };
})
.controller('View1Ctrl', ['$rootScope', '$scope', '$timeout',
  'uiGridConstants', '_',
  'stateModel', 'assetsModel', 'digestsModel',
  function ($rootScope, $scope, $timeout, uiGridConstants, _,
    stateModel, assetsModel, digestsModel) {

    // transient UI state
    $scope.stateModel = stateModel;
    $scope.assetsModel = assetsModel;
    $scope.digestsModel = digestsModel;

    // cached data
    $scope.reset = function() {
      $scope.stateModel.current.transient.busy = false;
      $scope.stateModel.current.transient.cancel = false;

      $scope.duplicates = [];

      $scope.digestsModel.reset();
      $scope.assetsModel.reset();

      $scope.analysis = {
        duplicateCount: 0,
        duplicateBytes: 0,
        percentDuplicated: 0
      };
    };
    $scope.reset();

    $scope.isBusy = function()
    {
      return $scope.stateModel.current.transient.busy;
    }

    $scope.canEdit = function()
    {
      return !$scope.stateModel.current.transient.busy;
    }

    // persist current ui state
    $scope.$watch('stateModel.current.accordion[0].open', function(isOpen) {
        $scope.stateModel.save_state();
      });

    $scope.$watch('stateModel.current.accordion[1].open', function(isOpen) {
        $scope.stateModel.save_state();
      });

    $scope.resetButtonClicked = function() {
      $scope.reset();
    };

    $scope.actionButtonClicked = function() {
      if ($scope.isBusy())
      {
        // cancel
        $scope.stateModel.current.transient.cancel = true;
      }
      else
      {
        $scope.reset();

        // open the files accordion
        $scope.stateModel.current.accordion[1].open = true;

        $scope.showMsg('scanning...');

        // search for files
        $scope.refreshAssets(function() {
            $scope.stateModel.current.transient.busy = false;
            $scope.stateModel.current.transient.cancel = false;
            $scope.showMsg('scan complete');
          });
      }
    };

    // trigger an update of the assets model
    $scope.refreshAssets = function (cb) {
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
          cb);
      }
      else
      {
        cb(null);
      }
    };

    // react to assetsModel update
    $scope.$on('assets:updated', function (event, data) {
      //$scope.assets = assetsModel.data;
    });

    // react to assetsModel update
    $scope.$on('digests:updated', function (event, data) {

      // merge digest into duplicates array
      var merge = function (duplicate) {
        var index = $scope.duplicates.findIndex(function (item, i) {
          return (item.hash == duplicate.hash);
        });

        var size = $scope.digestsModel.path_size_map[duplicate.paths[0]];
        if (index >= 0)
        {
          // already exists so merge
          duplicate.paths.forEach(function(new_path) {
            var path_index = $scope.duplicates[index].paths.indexOf(new_path);
            if (path_index < 0)
            {
              // not found so insert
              $scope.duplicates[index].paths.push(new_path);
              $scope.analysis.duplicateCount += 1;
              $scope.analysis.duplicateBytes += size;
            }
          });
        }
        else
        {
          // new item
          $scope.duplicates.push(duplicate);
          $scope.analysis.duplicateCount += 1;
          $scope.analysis.duplicateBytes += size;
        }

        // update stats
        $scope.analysis.percentDuplicated = Math.round(($scope.analysis.duplicateBytes / $scope.assetsModel.totalBytes) * 100);
      };

      // update duplicates array with new information
      for (var d in $scope.digestsModel.digest_path_map)
      {
        if ($scope.stateModel.current.transient.cancel)
        {
          break;
        }

        // any duplicates?
        if ($scope.digestsModel.digest_path_map[d].length > 1)
        {
          merge({ hash: d, paths: $scope.digestsModel.digest_path_map[d]});
        }
      }
    });

    $scope.showMsg = function(msg) {
      $scope.msg = msg;
    };

    $scope.$on('error', function (event, data) {
      $scope.msg = data;
    });

    $scope.addFolder = function () {
      // insert a new row
      $scope.stateModel.current.folders.unshift({"enabled": true, "path": ''});

      // now set focus to that new cell (after the menu collapses)
      $timeout(function() {
        $scope.gridOptionsFolders.gridApi.cellNav.scrollToFocus(
          $scope.stateModel.current.folders[0],
          $scope.gridOptionsFolders.columnDefs[0]);
      }, 0);
    }

    $scope.deleteFolder = function () {
      var rowCol = $scope.gridOptionsFolders.gridApi.cellNav.getFocusedCell();
      if(rowCol !== null) {
        // delete the current row
        var index = $scope.stateModel.current.folders.indexOf(rowCol.row.entity);
        $scope.stateModel.current.folders.splice(index, 1);
      }
    }

    $scope.gridOptionsAssets = {
      enableSorting: true,
      columnDefs: [
        { name: 'date',
          cellTemplate: '<div class="ui-grid-cell-contents" title="TOOLTIP">{{row.entity.date | prettyDate}}</div>' },
        { name: 'path', type: 'string' },
        { name: 'size', type: 'number' }
      ],
      data: "assetsModel.data"
    };

    $scope.gridOptionsFolders = {
      enableSorting: true,
      columnDefs: [
        {
          name: 'path',
          field: 'path',
          enableCellEdit: true,
          enableCellEditOnFocus: true,
          cellEditableCondition : $scope.canEdit
        }
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
    $scope.showMsg('Optionally adjust your search settings, then press Scan');
  }
]);
