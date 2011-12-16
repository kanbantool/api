/**
 * A javascript library for interacting with KanbanTool (kanbantool.com) API
 * through the JSONP interface. See http://kanbantool.com/about/api for more details
 *
 * @prerequisite jQuery
 * @version 0.5
 * @apiVersion 1.0
 *
 * Sample usage:
 *     KanbanTool.Api.onError = function(e){ alert('Doh. API error error has occured:\n' + e.message); }
 *      KanbanTool.api  = new KanbanTool.Api('YOUR_ACCOUNT_DOMAIN_HERE', 'YOUR_API_TOKEN_HERE');
 *
 *      KanbanTool.api.getBoards( function(boards){
 *        if( window.console ){ console.log('Got boards: ', boards); }
 *        alert("You have following boards on your account:\n" + boards.map(function(b){ return b.name }).join(' ,') )
 *
 *        if( boards.length > 0 &&
 *          confirm('Would you like to add test task to ' + boards[0].name + ' board?') ){
 *          KanbanTool.api.createTask( boards[0].id, {'task[name]':'Created','task[description]':'Lorem ipsum'}, function(task){
 *            if( window.console ){ console.log('Got task', task); }
 *
 *             KanbanTool.api.createTaskComment( boards[0].id, task.id, {'comment[content]':'A comment'}, function(comment){
 *               console.log('Got comment', comment);
 *
 *               alert('A new task with comment has just been created on the ' + boards[0].name + ' board.');
 *            });
 *          });
 *        }
 *      });
 *
 *
 * Copyright (C) 2011 by Shore Labs for kanbantool.com
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

if(typeof KanbanTool == "undefined"){ KanbanTool = {}; }

/*
 * Javascript API binding for kanbantool.com
 * see http://kanbantool.com/about/api for more details
 */
KanbanTool.Api = function( subdomain, api_token ){
  this.subdomain      = subdomain;
  this.api_token      = api_token;
  this.defaultTimeout = 10000;

  /**
   * Helper method returning api endpoint URL based on the remembered subdomain
   * @param {string} API method relative URL
   */
  this.apiEndpoint = function( url ){
    return "https://" + this.subdomain + ".kanbantool.com/api/v1/" + url + '.json';
  };

  /**
   * Internal helper method handling low-level JSONP API calls
   * @param {string} method     - one of GET, POST, PUT, DELETE
   * @param {string} url        - relative api method URL like "tasks/show"
   * @param {hash} data         - data to pass to the API method
   * @param {function} success  - success callback function
   * @param {function} error    - error callback function
   */
  this.call = function( method, url, data, success, error ){
    if( error == null ){ error = this.defaultErrorHandler; }

    jQuery.ajax({
      'url'     : this.apiEndpoint(url),
      'success' : this.callErrorDetection( method, url, data, success, error ),
      'data'    : jQuery.extend(data, {'api_token':this.api_token, '_m':method}),
      'dataType': 'json'
    });


  };

  /**
   * Internal function to be used as JSONP success callback,
   * responsible for handling JSONP errors.
   *
   * With each JSONP request it sets a timeout which is waiting
   * for it to finish. If this doesn't happen before timeout,
   * it considers such request as failed and triggers error callback
   * with error code value 0. If response is received, it checks it
   * for status code and message, and if both are present, with code
   * different from 200, it calls the error handler.
   *
   * For params definition see the this.call method.
   * @returns {function} - function to be used as JSONP success handler
   */
  this.callErrorDetection = function( method, url, data, success, error ){

    // Prepare timeout function basing on this.defaultTimeout value
    var timeout = window.setTimeout( function(){
      error( {'code':     0,
              'message':  'unknown request error, server response not in JSON format or request timeout',
              'method':   method,
              'url':      url,
              'data':     data });
    }, this.defaultTimeout );


    // Return anonymous function to check response and cancel timeout
    return function( response ){

      // silently return when request has successfully completed after the timeout
      if(timeout == null){ return; }

      // clear the timeout now
      clearTimeout(timeout); timeout = null;

      // check response for errors and trigger appropriate callbacks
      if( response && response.code && response.message && response.code != 200 ){
        return error( { 'code':     response.code,
                        'message':  response.message,
                        'method':   method,
                        'url':      url,
                        'data':     data });
      } else {
        return success( response );
      }
    }
  };

  /**
   * Internal function to unpacks JSON responses,
   * making sure that each response can be accessed in uniform way.
   */
  this.unwrapJSON = function( what, callback ){
    return function( data ){
      if( jQuery.isArray(data) ){
        callback( jQuery.map(data, function(e){return e[what] ? e[what] : e}) );
      } else {
        callback( data[what] ? data[what] : data );
      }
    }
  };

  /**
   * Default error handler triggering the KanbanTool:Api:onError event
   * Can be overloaded if needed
   * @param {hash} error
   */
  this.defaultErrorHandler = function(error){
    if( KanbanTool.Api.onError ){ KanbanTool.Api.onError(error); }
    $(window).triggerHandler('KanbanTool:Api:onError', error);
  };

  /**
   * Returns array of boards which are visible to the API user
   * This is the entry point for most applications, since board
   * identifiers can be obtained only through this call.
   * @param {function} callback
   * @param {function} errorCallback
   * @returns {array} - array of boards
   */
  this.getBoards = function( callback, errorCallback ){
    this.call( 'GET', 'boards', {}, this.unwrapJSON('board', callback), errorCallback );
  };

  /**
   * Returns array of users and permissions for given board
   * @param {int} board_id
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getBoardSettings = function( board_id, callback, errorCallback ){
    this.call( 'GET', 'boards/' + board_id, {}, this.unwrapJSON('board', callback), errorCallback);
  };

  /**
   * Returns tasks on given board
   * @param {int} board_id
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getTasks = function( board_id, callback, errorCallback ){
    this.call(  'GET', 'boards/' + board_id + '/tasks',
                {},
                this.unwrapJSON('task', callback, errorCallback) );
  };

  /**
   * Gets the board changelog
   * Maximum number of changelog entries this method returns is 1.000
   * @param {int} board_id - Board identifier
   * @param {date} from - Only show results from given date (may be null)
   * @param {date} to - Only show results up to given date (may be null)
   * @param {int} limit - Limit number of results (may be null)
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getChangelog = function( board_id, from, to, limit, callback, errorCallback ){
    this.call(  'GET', 'boards/' + board_id + '/changelog',
                {'from':from, 'to':to, 'limit':limit},
                this.unwrapJSON('task', callback, errorCallback) );
  };


  /**
   * Creates task on given board
   * @param {int} board_id - Board identifier
   * @param {hash} params - Task parameters serialized to hash
   * @param {function} callback - success callback function
   * @param {function} errorCallback - error callback function
   * @example createTask(1234, {'task[name]':'created'})
   */
  this.createTask = function( board_id, params, callback, errorCallback ){
    this.call(  'POST', 'boards/' + board_id + '/tasks',
                params,
                this.unwrapJSON('task', callback, errorCallback ) );
  };


  /**
   * Updates task attributes
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {hash} params - Task parameters to update
   * @param {function} callback
   * @param {function} errorCallback
   * @example updateTask(1234, 5678, {'task[name]':'updated', 'task[description]':'Lorem ipsum...'})
   */
  this.updateTask = function( board_id, task_id, params, callback, errorCallback ){
    this.call(  'PUT', 'boards/' + board_id + '/tasks/' + task_id,
                params,
                callback, errorCallback );
  };

  /**
   * Move task in given direction
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {string} direction - one of: up, down, prev_stage, next_stage, prev_swimlane, next_swimlane
   * @param {string} wip_override - if set, will override any WIP limit with given comment
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.moveTask = function( board_id, task_id, direction, wip_override, callback, errorCallback ){
    this.call(  'PUT', 'boards/' + board_id + '/tasks/' + task_id + '/move',
                {'direction':direction, 'override':wip_override},
                callback, errorCallback );
  };

  /**
   * Move task to given workflow stage and swimlane
   * This cannot yet be used to move tasks across boards.
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {int} workflow_id - Target workflow stage identifier
   * @param {int} swimlane_id - Target swimlane identifier
   * @param {int} position - Position at which to place the task
   * @param {string} wip_override - if set, will override any WIP limit with given comment
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.moveTaskTo = function( board_id, task_id, workflow_id, swimlane_id, position, wip_override, callback, errorCallback ){
    this.call(  'PUT', 'boards/' + board_id + '/tasks/' + task_id + '/move',
                {'workflow_id':workflow_id, 'swimlane_id':swimlane_id},
                callback, errorCallback );
  };

  /**
   * Permanently deletes task from board.
   * Task which is being deleted cannot be archived
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.deleteTask = function( board_id, task_id, callback, errorCallback ){
    this.call(  'DELETE', 'boards/' + board_id + '/tasks/' + task_id,
                {},
                callback, errorCallback );
  };

  /**
   * Archives given task
   * Task must not be archived and be in the workflow stage which has archive.
   * This is usually the last workflow stage of board.
   * @param {int} board_id  - Board identifier
   * @param {int} task_id - Task identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.archiveTask = function( board_id, task_id, callback, errorCallback ){
    this.call(  'PUT', 'boards/' + board_id + '/tasks/' + task_id + '/archive',
                {},
                callback, errorCallback );
  };

  /**
   * Unarchives given task by putting it back on the board
   * Task must be archived.
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.unarchiveTask = function( board_id, task_id, callback, errorCallback ){
    this.call(  'PUT', 'boards/' + board_id + '/tasks/' + task_id + '/unarchive',
                {},
                callback, errorCallback );
  };

  /**
   * Returns array of comments for given task
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getTaskComments = function( board_id, task_id, callback, errorCallback ){
    this.call(  'GET', 'boards/' + board_id + '/tasks/' + task_id + '/comments',
                {},
                callback, errorCallback );
  };

  /**
   * Returns details about single task comment
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {int} comment_id - Comment identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getTaskComment = function( board_id, task_id, comment_id, callback, errorCallback ){
    this.call(  'GET', 'boards/' + board_id + '/tasks/' + task_id + '/comments/' + comment_id,
                {},
                this.unwrapJSON('comment', callback, errorCallback ) );
  };

  /**
   * Adds comment to task
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {hash} params - a hash of comment model attributes
   * @param {function} callback
   * @param {function} errorCallback
   * @returns {hash:Comment} - a hash of Comment model attributes
   * @example createTaskComment(123, 456, {'content':'A new comment'}, callback);
   */
  this.createTaskComment = function( board_id, task_id, params, callback, errorCallback ){
    this.call(  'POST', 'boards/' + board_id + '/tasks/' + task_id + '/comments',
                params,
                this.unwrapJSON('comment', callback, errorCallback ) );
  };

  /**
   * Deletes single comment from task
   * Only recent comments made by the same user can be deleted.
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {int} comment_id - Comment identifier
   * @param {function} callback
   * @param {function} errorCallback
   * @returns {hash:Comment} - returns deleted comment as a result
   */
  this.deleteTaskComment = function( board_id, task_id, comment_id, callback, errorCallback ){
    this.call(  'DELETE', 'boards/' + board_id + '/tasks/' + task_id + '/comments/' + comment_id,
                {},
                this.unwrapJSON('comment', callback, errorCallback ) );
  };

  /**
   * Returns array of subtasks of given task
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getTaskSubtasks = function( board_id, task_id, callback, errorCallback ){
    this.call(  'GET', 'boards/' + board_id + '/tasks/' + task_id + '/subtasks',
                {},
                callback, errorCallback );
  };

  /**
   * Returns details about single subtask for given task
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {int} subtask_id - Subtask identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.getTaskSubtask = function( board_id, task_id, subtask_id, callback, errorCallback ){
    this.call(  'GET', 'boards/' + board_id + '/tasks/' + task_id + '/subtasks/' + subtask_id,
                {},
                this.unwrapJSON('subtask', callback, errorCallback ) );
  };

  /**
   * Adds new subtask to the task
   * New subtask is addedd at the bottom of the list.
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {hash} params - a hash of Subtask model attributes
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.createTaskSubtask = function( board_id, task_id, params, callback, errorCallback ){
    this.call(  'POST', 'boards/' + board_id + '/tasks/' + task_id + '/subtasks',
                params,
                this.unwrapJSON('subtask', callback, errorCallback ) );
  };

  /**
   * Deletes single subtask from task
   * @param {int} board_id  - Board identifier
   * @param {int} task_id - Task identifier
   * @param {int} subtask_id - Subtask identifier
   * @param {function} callback
   * @param {function} errorCallback
   */
  this.deleteTaskSubtask = function( board_id, task_id, subtask_id, callback, errorCallback ){
    this.call(  'DELETE', 'boards/' + board_id + '/tasks/' + task_id + '/subtasks/' + subtask_id,
                {},
                this.unwrapJSON('subtask', callback, errorCallback ) );
  };

  /**
   * Reorders subtasks for given task.
   * New order of subtasks is given as an sorted array of subtask IDs.
   * The array must be a complete list of subtasks IDs for given task.
   * @param {int} board_id - Board identifier
   * @param {int} task_id - Task identifier
   * @param {array} new_order - array of subtask IDs in the new order
   * @param {function} callback
   * @param {function} errorCallback
   * @example reorderTaskSubtasks( 1234, 456, [5,2,5], callback );
   */
  this.reorderTaskSubtasks = function( board_id, task_id, new_order, callback, errorCallback ){
    this.call(  'PUT', 'boards/' + board_id + '/tasks/' + task_id + '/subtasks',
                {'order':new_order.join(',')},
                callback, errorCallback );
  };

};
