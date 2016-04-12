# deduper (**work in progress**)
Python file deduplication utility with an AngularJS front-end

## compatibility
Currently only tested/enabled on Windows 10+ with Python 3.5+ and/or NodeJS.

## setup - Python
1. install Python: https://www.python.org/downloads/windows
2. pip install pypiwin32
3. pip install winshell
4. pip install cherrypy

## setup - NodeJS
1. install NodeJS (https://nodejs.org/)

## usage
* clone from github repo
* navigate to root of repo
* Start the server (one of):
  * **Python**: npm start
  * **NodeJS**: cd js
  node server.js
* Navigate to this url in your browser:
http://localhost:8080/#/view1    

## TODO
|feature|details|expected effort|
|-------|-------|-------|
|File Server|Serve local image files for thumbnails|medium|
|Thumbnails|Better UI representation for duplicates|medium|
|Cloud|Support s3 as a file source|medium|
|Setup|Determine all dependencies for clean-machine install|medium|
|Messages|Create/Display messages in a uniform fashion|small|
|Unit Tests|Validate duplicate detection and stats|medium|
|e2e Tests|Validate UI functionality|medium|
|Dedup 1: delete|Support actually deleting all duplicates|medium|
|Dedup 2: reorg|Support copying all files to a new folder structure based on dates|medium|
|Dedup 3: quarantine|Support moving only duplicates to quarantine folder|medium|
|Minify|Compile/minify the javascript for efficient loading|small|

## Completed
|feature|details|date|
|-------|-------|-------|
|Custom paths|Add/Remove/Edit folder search paths|2/20/2016|
|Python 3.x|Verify compatibility with Python 3.x. Abandoned 2.7 support.|2/25/2016|

## dependencies
|library| usage | site | version
|-------|------|-------|---------|
|CherryPy | simple http server| http://cherrypy.org| 5.0.1 |
|angularjs|ux framework|https://angularjs.org|1.5.0|
|ui-grid | grid ui | http://ui-grid.info | 3.1.1 |
|bootstrap|CSS formatting done easy|http://getbootstrap.com|3.3.6|
|underscorejs|Useful JS utilities|http://underscorejs.org|1.8.3|
|async|Async pattern utilities for JS|https://github.com/caolan/async|1.5.2|

## credits
Inspired by [DuplicateFiles](https://github.com/djruesch/Herramientas).
Unit Testing [AirPair](https://www.airpair.com/angularjs).
