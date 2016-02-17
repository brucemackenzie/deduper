'use strict';

//-------------------------------------------------
// Special thanks to those who shared their knowledge:
// http://joelhooks.com/blog/2013/04/24/modeling-data-and-state-in-your-angularjs-application/
//-------------------------------------------------

// Declare app level module which depends on views, and components
angular.module('myApp', [
  'ngRoute',
  'ngResource',
  'ngAnimate',
  'webStorageModule',
  'myApp.view1',
  'myApp.view2',
  'myApp.version',
  'ui.bootstrap'
]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.
    when('/', {
      controller: 'View1Ctrl',
      templateUrl: 'view1.html'
    }).
    otherwise({redirectTo: '/view1'});
}]);
