export function GridsterDebounce(func, wait, immediate) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

export function GridsterTouch(target, startEvent, moveEvent, endEvent) {
  var lastXYById = {};

  //  Opera doesn't have Object.keys so we use this wrapper
  var numberOfKeys = function(theObject) {
    if (Object.keys) {
      return Object.keys(theObject).length;
    }

    var n = 0,
      key;
    for (key in theObject) {
      ++n;
    }

    return n;
  };

  //  this calculates the delta needed to convert pageX/Y to offsetX/Y because offsetX/Y don't exist in the TouchEvent object or in Firefox's MouseEvent object
  var computeDocumentToElementDelta = function(theElement) {
    var elementLeft = 0;
    var elementTop = 0;
    var oldIEUserAgent = navigator.userAgent.match(/\bMSIE\b/);

    for (var offsetElement = theElement; offsetElement != null; offsetElement = offsetElement.offsetParent) {
      //  the following is a major hack for versions of IE less than 8 to avoid an apparent problem on the IEBlog with double-counting the offsets
      //  this may not be a general solution to IE7's problem with offsetLeft/offsetParent
      if (oldIEUserAgent &&
        (!document.documentMode || document.documentMode < 8) &&
        offsetElement.currentStyle.position === 'relative' && offsetElement.offsetParent && offsetElement.offsetParent.currentStyle.position === 'relative' && offsetElement.offsetLeft === offsetElement.offsetParent.offsetLeft) {
        // add only the top
        elementTop += offsetElement.offsetTop;
      } else {
        elementLeft += offsetElement.offsetLeft;
        elementTop += offsetElement.offsetTop;
      }
    }

    return {
      x: elementLeft,
      y: elementTop
    };
  };

  //  cache the delta from the document to our event target (reinitialized each mousedown/MSPointerDown/touchstart)
  var documentToTargetDelta = computeDocumentToElementDelta(target);
  var useSetReleaseCapture = false;

  //  common event handler for the mouse/pointer/touch models and their down/start, move, up/end, and cancel events
  var doEvent = function(theEvtObj) {

    if (theEvtObj.type === 'mousemove' && numberOfKeys(lastXYById) === 0) {
      return;
    }

    var prevent = true;

    var pointerList = theEvtObj.changedTouches ? theEvtObj.changedTouches : [theEvtObj];
    for (var i = 0; i < pointerList.length; ++i) {
      var pointerObj = pointerList[i];
      var pointerId = (typeof pointerObj.identifier !== 'undefined') ? pointerObj.identifier : (typeof pointerObj.pointerId !== 'undefined') ? pointerObj.pointerId : 1;

      //  use the pageX/Y coordinates to compute target-relative coordinates when we have them (in ie < 9, we need to do a little work to put them there)
      if (typeof pointerObj.pageX === 'undefined') {
        //  initialize assuming our source element is our target
        pointerObj.pageX = pointerObj.offsetX + documentToTargetDelta.x;
        pointerObj.pageY = pointerObj.offsetY + documentToTargetDelta.y;

        if (pointerObj.srcElement.offsetParent === target && document.documentMode && document.documentMode === 8 && pointerObj.type === 'mousedown') {
          //  source element is a child piece of VML, we're in IE8, and we've not called setCapture yet - add the origin of the source element
          pointerObj.pageX += pointerObj.srcElement.offsetLeft;
          pointerObj.pageY += pointerObj.srcElement.offsetTop;
        } else if (pointerObj.srcElement !== target && !document.documentMode || document.documentMode < 8) {
          //  source element isn't the target (most likely it's a child piece of VML) and we're in a version of IE before IE8 -
          //  the offsetX/Y values are unpredictable so use the clientX/Y values and adjust by the scroll offsets of its parents
          //  to get the document-relative coordinates (the same as pageX/Y)
          var sx = -2,
            sy = -2; // adjust for old IE's 2-pixel border
          for (var scrollElement = pointerObj.srcElement; scrollElement !== null; scrollElement = scrollElement.parentNode) {
            sx += scrollElement.scrollLeft ? scrollElement.scrollLeft : 0;
            sy += scrollElement.scrollTop ? scrollElement.scrollTop : 0;
          }

          pointerObj.pageX = pointerObj.clientX + sx;
          pointerObj.pageY = pointerObj.clientY + sy;
        }
      }


      var pageX = pointerObj.pageX;
      var pageY = pointerObj.pageY;

      if (theEvtObj.type.match(/(start|down)$/i)) {
        //  clause for processing MSPointerDown, touchstart, and mousedown

        //  refresh the document-to-target delta on start in case the target has moved relative to document
        documentToTargetDelta = computeDocumentToElementDelta(target);

        //  protect against failing to get an up or end on this pointerId
        if (lastXYById[pointerId]) {
          if (endEvent) {
            endEvent({
              target: theEvtObj.target,
              which: theEvtObj.which,
              pointerId: pointerId,
              pageX: pageX,
              pageY: pageY
            });
          }

          delete lastXYById[pointerId];
        }

        if (startEvent) {
          if (prevent) {
            prevent = startEvent({
              target: theEvtObj.target,
              which: theEvtObj.which,
              pointerId: pointerId,
              pageX: pageX,
              pageY: pageY
            });
          }
        }

        //  init last page positions for this pointer
        lastXYById[pointerId] = {
          x: pageX,
          y: pageY
        };

        // IE pointer model
        if (target.msSetPointerCapture && prevent) {
          target.msSetPointerCapture(pointerId);
        } else if (theEvtObj.type === 'mousedown' && numberOfKeys(lastXYById) === 1) {
          if (useSetReleaseCapture) {
            target.setCapture(true);
          } else {
            document.addEventListener('mousemove', doEvent, false);
            document.addEventListener('mouseup', doEvent, false);
          }
        }
      } else if (theEvtObj.type.match(/move$/i)) {
        //  clause handles mousemove, MSPointerMove, and touchmove

        if (lastXYById[pointerId] && !(lastXYById[pointerId].x === pageX && lastXYById[pointerId].y === pageY)) {
          //  only extend if the pointer is down and it's not the same as the last point

          if (moveEvent && prevent) {
            prevent = moveEvent({
              target: theEvtObj.target,
              which: theEvtObj.which,
              pointerId: pointerId,
              pageX: pageX,
              pageY: pageY
            });
          }

          //  update last page positions for this pointer
          lastXYById[pointerId].x = pageX;
          lastXYById[pointerId].y = pageY;
        }
      } else if (lastXYById[pointerId] && theEvtObj.type.match(/(up|end|cancel)$/i)) {
        //  clause handles up/end/cancel

        if (endEvent && prevent) {
          prevent = endEvent({
            target: theEvtObj.target,
            which: theEvtObj.which,
            pointerId: pointerId,
            pageX: pageX,
            pageY: pageY
          });
        }

        //  delete last page positions for this pointer
        delete lastXYById[pointerId];

        //  in the Microsoft pointer model, release the capture for this pointer
        //  in the mouse model, release the capture or remove document-level event handlers if there are no down points
        //  nothing is required for the iOS touch model because capture is implied on touchstart
        if (target.msReleasePointerCapture) {
          target.msReleasePointerCapture(pointerId);
        } else if (theEvtObj.type === 'mouseup' && numberOfKeys(lastXYById) === 0) {
          if (useSetReleaseCapture) {
            target.releaseCapture();
          } else {
            document.removeEventListener('mousemove', doEvent, false);
            document.removeEventListener('mouseup', doEvent, false);
          }
        }
      }
    }

    if (prevent) {
      if (theEvtObj.preventDefault) {
        theEvtObj.preventDefault();
      }

      if (theEvtObj.preventManipulation) {
        theEvtObj.preventManipulation();
      }

      if (theEvtObj.preventMouseEvent) {
        theEvtObj.preventMouseEvent();
      }
    }
  };

  // saving the settings for contentZooming and touchaction before activation
  var contentZooming, msTouchAction;

  this.enable = function() {

    if (window.navigator.msPointerEnabled) {
      //  Microsoft pointer model
      target.addEventListener('MSPointerDown', doEvent, false);
      target.addEventListener('MSPointerMove', doEvent, false);
      target.addEventListener('MSPointerUp', doEvent, false);
      target.addEventListener('MSPointerCancel', doEvent, false);

      //  css way to prevent panning in our target area
      if (typeof target.style.msContentZooming !== 'undefined') {
        contentZooming = target.style.msContentZooming;
        target.style.msContentZooming = 'none';
      }

      //  new in Windows Consumer Preview: css way to prevent all built-in touch actions on our target
      //  without this, you cannot touch draw on the element because IE will intercept the touch events
      if (typeof target.style.msTouchAction !== 'undefined') {
        msTouchAction = target.style.msTouchAction;
        target.style.msTouchAction = 'none';
      }
    } else if (target.addEventListener) {
      //  iOS touch model
      target.addEventListener('touchstart', doEvent, false);
      target.addEventListener('touchmove', doEvent, false);
      target.addEventListener('touchend', doEvent, false);
      target.addEventListener('touchcancel', doEvent, false);

      //  mouse model
      target.addEventListener('mousedown', doEvent, false);

      //  mouse model with capture
      //  rejecting gecko because, unlike ie, firefox does not send events to target when the mouse is outside target
      if (target.setCapture && !window.navigator.userAgent.match(/\bGecko\b/)) {
        useSetReleaseCapture = true;

        target.addEventListener('mousemove', doEvent, false);
        target.addEventListener('mouseup', doEvent, false);
      }
    } else if (target.attachEvent && target.setCapture) {
      //  legacy IE mode - mouse with capture
      useSetReleaseCapture = true;
      target.attachEvent('onmousedown', function() {
        doEvent(window.event);
        window.event.returnValue = false;
        return false;
      });
      target.attachEvent('onmousemove', function() {
        doEvent(window.event);
        window.event.returnValue = false;
        return false;
      });
      target.attachEvent('onmouseup', function() {
        doEvent(window.event);
        window.event.returnValue = false;
        return false;
      });
    }
  };

  this.disable = function() {
    if (window.navigator.msPointerEnabled) {
      //  Microsoft pointer model
      target.removeEventListener('MSPointerDown', doEvent, false);
      target.removeEventListener('MSPointerMove', doEvent, false);
      target.removeEventListener('MSPointerUp', doEvent, false);
      target.removeEventListener('MSPointerCancel', doEvent, false);

      //  reset zooming to saved value
      if (contentZooming) {
        target.style.msContentZooming = contentZooming;
      }

      // reset touch action setting
      if (msTouchAction) {
        target.style.msTouchAction = msTouchAction;
      }
    } else if (target.removeEventListener) {
      //  iOS touch model
      target.removeEventListener('touchstart', doEvent, false);
      target.removeEventListener('touchmove', doEvent, false);
      target.removeEventListener('touchend', doEvent, false);
      target.removeEventListener('touchcancel', doEvent, false);

      //  mouse model
      target.removeEventListener('mousedown', doEvent, false);

      //  mouse model with capture
      //  rejecting gecko because, unlike ie, firefox does not send events to target when the mouse is outside target
      if (target.setCapture && !window.navigator.userAgent.match(/\bGecko\b/)) {
        useSetReleaseCapture = true;

        target.removeEventListener('mousemove', doEvent, false);
        target.removeEventListener('mouseup', doEvent, false);
      }
    } else if (target.detachEvent && target.setCapture) {
      //  legacy IE mode - mouse with capture
      useSetReleaseCapture = true;
      target.detachEvent('onmousedown');
      target.detachEvent('onmousemove');
      target.detachEvent('onmouseup');
    }
  };

  return this;
}

export function GridsterDraggable(item) {

  var elmX, elmY, elmW, elmH,

    mouseX = 0,
    mouseY = 0,
    lastMouseX = 0,
    lastMouseY = 0,
    mOffX = 0,
    mOffY = 0,

    minTop = 0,
    minLeft = 0;

  var originalCol, originalRow;
  var inputTags = ['select', 'option', 'input', 'textarea', 'button'];

  function dragStart(event) {
    item.$el.classList.add('gridster-item-moving');
    item.gridster.movingItem = item;

    item.gridster.updateHeightPlus(item.sizeY);

    if (item.gridster.draggable && item.gridster.draggable.start) {
      item.gridster.draggable.start(event, item);
    }
  }

  function drag(event) {
    var oldRow = item.row,
      oldCol = item.col,
      hasCallback = item.gridster.draggable && item.gridster.draggable.drag,
      scrollSensitivity = item.gridster.draggable.scrollSensitivity,
      scrollSpeed = item.gridster.draggable.scrollSpeed;

    var row = Math.min(item.gridster.pixelsToRows(elmY), item.gridster.maxRows - 1);
    var col = Math.min(item.gridster.pixelsToColumns(elmX), item.gridster.columns - 1);

    var itemsInTheWay = item.gridster.getItems(row, col, item.sizeX, item.sizeY, item);
    var hasItemsInTheWay = itemsInTheWay.length !== 0;

    if (item.gridster.swapping === true && hasItemsInTheWay) {
      var boundingBoxItem = item.gridster.getBoundingBox(itemsInTheWay),
        sameSize = boundingBoxItem.sizeX === item.sizeX && boundingBoxItem.sizeY === item.sizeY,
        sameRow = boundingBoxItem.row === oldRow,
        sameCol = boundingBoxItem.col === oldCol,
        samePosition = boundingBoxItem.row === row && boundingBoxItem.col === col,
        inline = sameRow || sameCol;

      if (sameSize && itemsInTheWay.length === 1) {
        if (samePosition) {
          item.gridster.swapItems(item, itemsInTheWay[0]);
        } else if (inline) {
          return;
        }
      } else if (boundingBoxItem.sizeX <= item.sizeX && boundingBoxItem.sizeY <= item.sizeY && inline) {
        var emptyRow = item.row <= row ? item.row : row + item.sizeY,
          emptyCol = item.col <= col ? item.col : col + item.sizeX,
          rowOffset = emptyRow - boundingBoxItem.row,
          colOffset = emptyCol - boundingBoxItem.col;

        for (var i = 0, l = itemsInTheWay.length; i < l; ++i) {
          var itemInTheWay = itemsInTheWay[i];

          var itemsInFreeSpace = item.gridster.getItems(
            itemInTheWay.row + rowOffset,
            itemInTheWay.col + colOffset,
            itemInTheWay.sizeX,
            itemInTheWay.sizeY,
            item
          );

          if (itemsInFreeSpace.length === 0) {
            item.gridster.putItem(itemInTheWay, itemInTheWay.row + rowOffset, itemInTheWay.col + colOffset);
          }
        }
      }
    }

    if (item.gridster.pushing !== false || !hasItemsInTheWay) {
      item.row = row;
      item.col = col;
    }

    if (event.pageY - document.body.scrollTop < scrollSensitivity) {
      document.body.scrollTop = document.body.scrollTop - scrollSpeed;
    } else if (window.innerHeight - (event.pageY - document.body.scrollTop) < scrollSensitivity) {
      document.body.scrollTop = document.body.scrollTop + scrollSpeed;
    }

    if (event.pageX - document.body.scrollLeft < scrollSensitivity) {
      document.body.scrollLeft = document.body.scrollLeft - scrollSpeed;
    } else if (window.innerWidth - (event.pageX - document.body.scrollLeft) < scrollSensitivity) {
      document.body.scrollLeft = document.body.scrollLeft + scrollSpeed;
    }

    if (hasCallback || oldRow !== item.row || oldCol !== item.col) {
      if (hasCallback) {
        item.gridster.draggable.drag(event, item);
      }
    }
  }

  function dragStop(event) {
    item.$el.classList.remove('gridster-item-moving');
    var row = Math.min(item.gridster.pixelsToRows(elmY), item.gridster.maxRows - 1);
    var col = Math.min(item.gridster.pixelsToColumns(elmX), item.gridster.columns - 1);
    if (item.gridster.pushing !== false || item.gridster.getItems(row, col, item.sizeX, item.sizeY, item).length === 0) {
      item.row = row;
      item.col = col;
    }
    item.gridster.movingItem = null;
    item.setPosition(item.row, item.col);

    if (item.gridster.draggable && item.gridster.draggable.stop) {
      item.gridster.draggable.stop(event, item);
    }
  }

  function mouseDown(e) {
    if (inputTags.indexOf(e.target.nodeName.toLowerCase()) !== -1) {
      return false;
    }

    var $target = e.target;

    // exit, if a resize handle was hit
    if ($target.classList.contains('gridster-item-resizable-handler')) {
      return false;
    }

    // exit, if the target has it's own click event
    // TODO: 这个需要处理
    // if ($target.attr('onclick') || $target.attr('ng-click')) {
    //     return false;
    // }

    // only works if you have jQuery
    // TODO: 这个需要处理
    // if ($target.closest && $target.closest('.gridster-no-drag').length) {
    //     return false;
    // }

    // apply drag handle filter
    if (item.gridster.draggable && item.gridster.draggable.handle) {
      var $dragHandles = item.$el.querySelectorAll(gridster.draggable.handle);
      var match = false;
      outerloop:
        for (var h = 0, hl = $dragHandles.length; h < hl; ++h) {
          var handle = $dragHandles[h];
          if (handle === e.target) {
            match = true;
            break;
          }
          var target = e.target;
          for (var p = 0; p < 20; ++p) {
            var parent = target.parentNode;
            if (parent === item.$el || !parent) {
              break;
            }
            if (parent === handle) {
              match = true;
              break outerloop;
            }
            target = parent;
          }
        }
      if (!match) {
        return false;
      }
    }

    switch (e.which) {
      case 1:
        // left mouse button
        break;
      case 2:
      case 3:
        // right or middle mouse button
        return;
    }

    lastMouseX = e.pageX;
    lastMouseY = e.pageY;

    let left = parseInt(item.$el.style.left, 10), top = parseInt(item.$el.style.top, 10);
    elmX = (isNaN(left) ? 0 : left);
    elmY = (isNaN(top) ? 0 : top);
    elmW = item.$el.offsetWidth;
    elmH = item.$el.offsetHeight;

    originalCol = item.col;
    originalRow = item.row;

    dragStart(e);

    return true;
  }

  function mouseMove(e) {
    if (!item.$el.classList.contains('gridster-item-moving') || item.$el.classList.contains('gridster-item-resizing')) {
      return false;
    }

    var maxLeft = item.gridster.curWidth - 1;
    var maxTop = item.gridster.curRowHeight * item.gridster.maxRows - 1;

    // Get the current mouse position.
    mouseX = e.pageX;
    mouseY = e.pageY;

    // Get the deltas
    var diffX = mouseX - lastMouseX + mOffX;
    var diffY = mouseY - lastMouseY + mOffY;
    mOffX = mOffY = 0;

    // Update last processed mouse positions.
    lastMouseX = mouseX;
    lastMouseY = mouseY;

    var dX = diffX,
      dY = diffY;
    if (elmX + dX < minLeft) {
      diffX = minLeft - elmX;
      mOffX = dX - diffX;
    } else if (elmX + elmW + dX > maxLeft) {
      diffX = maxLeft - elmX - elmW;
      mOffX = dX - diffX;
    }

    if (elmY + dY < minTop) {
      diffY = minTop - elmY;
      mOffY = dY - diffY;
    } else if (elmY + elmH + dY > maxTop) {
      diffY = maxTop - elmY - elmH;
      mOffY = dY - diffY;
    }
    elmX += diffX;
    elmY += diffY;

    // set new position
    item.$el.style.top = elmY + 'px';
    item.$el.style.left = elmX + 'px';

    drag(e);

    return true;
  }

  function mouseUp(e) {
    if (!item.$el.classList.contains('gridster-item-moving') || item.$el.classList.contains('gridster-item-resizing')) {
      return false;
    }

    mOffX = mOffY = 0;

    dragStop(e);

    return true;
  }

  var enabled = null;
  var gridsterTouch = null;

  this.enable = function() {
    if (enabled === true) {
      return;
    }
    enabled = true;

    if (gridsterTouch) {
      gridsterTouch.enable();
      return;
    }

    gridsterTouch = new GridsterTouch(item.$el, mouseDown, mouseMove, mouseUp);
    gridsterTouch.enable();
  };

  this.disable = function() {
    if (enabled === false) {
      return;
    }

    enabled = false;
    if (gridsterTouch) {
      gridsterTouch.disable();
    }
  };

  this.toggle = function(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  };

  this.destroy = function() {
    this.disable();
  };
}

export function GridsterResizable(item) {
  //import {GridsterTouch} from "./vue-gridster-utils"

  function ResizeHandle(handleClass) {

    var hClass = handleClass;

    var elmX, elmY, elmW, elmH,

      mouseX = 0,
      mouseY = 0,
      lastMouseX = 0,
      lastMouseY = 0,
      mOffX = 0,
      mOffY = 0,

      minTop = 0,
      maxTop = 9999,
      minLeft = 0;

    var getMinHeight = function() {
      return (item.minSizeY ? item.minSizeY : 1) * item.gridster.curRowHeight - item.gridster.margins[0];
    };
    var getMinWidth = function() {
      return (item.minSizeX ? item.minSizeX : 1) * item.gridster.curColWidth - item.gridster.margins[1];
    };

    var originalWidth, originalHeight;
    var savedDraggable;

    function resizeStart(e) {
      item.$el.classList.add('gridster-item-moving');
      item.$el.classList.add('gridster-item-resizing');

      item.gridster.movingItem = item;

      item.setElementSizeX();
      item.setElementSizeY();
      item.setElementPosition();
      item.gridster.updateHeightPlus(1);

      // callback
      if (item.gridster.resizable && item.gridster.resizable.start) {
        item.gridster.resizable.start(e, item); // options is the item model
      }
    }

    function resize(e) {
      var oldRow = item.row,
        oldCol = item.col,
        oldSizeX = item.sizeX,
        oldSizeY = item.sizeY,
        hasCallback = item.gridster.resizable && item.gridster.resizable.resize;

      var col = item.col;
      // only change column if grabbing left edge
      if (['w', 'nw', 'sw'].indexOf(handleClass) !== -1) {
        col = item.gridster.pixelsToColumns(elmX, false);
      }

      var row = item.row;
      // only change row if grabbing top edge
      if (['n', 'ne', 'nw'].indexOf(handleClass) !== -1) {
        row = item.gridster.pixelsToRows(elmY, false);
      }

      var sizeX = item.sizeX;
      // only change row if grabbing left or right edge
      if (['n', 's'].indexOf(handleClass) === -1) {
        sizeX = item.gridster.pixelsToColumns(elmW, true);
      }

      var sizeY = item.sizeY;
      // only change row if grabbing top or bottom edge
      if (['e', 'w'].indexOf(handleClass) === -1) {
        sizeY = item.gridster.pixelsToRows(elmH, true);
      }


      var canOccupy = row > -1 && col > -1 && sizeX + col <= item.gridster.columns && sizeY + row <= item.gridster.maxRows;
      if (canOccupy && (item.gridster.pushing !== false || item.gridster.getItems(row, col, sizeX, sizeY, item).length === 0)) {
        item.row = row;
        item.col = col;
        item.sizeX = sizeX;
        item.sizeY = sizeY;
      }
      var isChanged = item.row !== oldRow || item.col !== oldCol || item.sizeX !== oldSizeX || item.sizeY !== oldSizeY;

      if (hasCallback || isChanged) {
        if (hasCallback) {
          item.gridster.resizable.resize(e, item); // options is the item model
        }
      }
    }

    function resizeStop(e) {
      item.$el.classList.remove('gridster-item-moving');
      item.$el.classList.remove('gridster-item-resizing');

      item.gridster.movingItem = null;

      item.setPosition(item.row, item.col);
      item.setSizeY(item.sizeY);
      item.setSizeX(item.sizeX);

      if (item.gridster.resizable && item.gridster.resizable.stop) {
        item.gridster.resizable.stop(e, item); // options is the item model
      }
    }

    function mouseDown(e) {
      switch (e.which) {
        case 1:
          // left mouse button
          break;
        case 2:
        case 3:
          // right or middle mouse button
          return;
      }

      // save the draggable setting to restore after resize
      savedDraggable = item.gridster.draggable.enabled;
      if (savedDraggable) {
        item.gridster.draggable.enabled = false;
        item.gridster.$emit('gridster-draggable-changed', item.gridster);
      }

      // Get the current mouse position.
      lastMouseX = e.pageX;
      lastMouseY = e.pageY;

      // Record current widget dimensions

      let left = parseInt(item.$el.style.left, 10), top = parseInt(item.$el.style.top, 10);
      elmX = (isNaN(left) ? 0 : left);
      elmY = (isNaN(top) ? 0 : top);
      elmW = item.$el.offsetWidth;
      elmH = item.$el.offsetHeight;

      originalWidth = item.sizeX;
      originalHeight = item.sizeY;

      resizeStart(e);

      return true;
    }

    function mouseMove(e) {
      var maxLeft = item.gridster.curWidth - 1;

      // Get the current mouse position.
      mouseX = e.pageX;
      mouseY = e.pageY;

      // Get the deltas
      var diffX = mouseX - lastMouseX + mOffX;
      var diffY = mouseY - lastMouseY + mOffY;
      mOffX = mOffY = 0;

      // Update last processed mouse positions.
      lastMouseX = mouseX;
      lastMouseY = mouseY;

      var dY = diffY,
        dX = diffX;

      if (hClass.indexOf('n') >= 0) {
        if (elmH - dY < getMinHeight()) {
          diffY = elmH - getMinHeight();
          mOffY = dY - diffY;
        } else if (elmY + dY < minTop) {
          diffY = minTop - elmY;
          mOffY = dY - diffY;
        }
        elmY += diffY;
        elmH -= diffY;
      }
      if (hClass.indexOf('s') >= 0) {
        if (elmH + dY < getMinHeight()) {
          diffY = getMinHeight() - elmH;
          mOffY = dY - diffY;
        } else if (elmY + elmH + dY > maxTop) {
          diffY = maxTop - elmY - elmH;
          mOffY = dY - diffY;
        }
        elmH += diffY;
      }
      if (hClass.indexOf('w') >= 0) {
        if (elmW - dX < getMinWidth()) {
          diffX = elmW - getMinWidth();
          mOffX = dX - diffX;
        } else if (elmX + dX < minLeft) {
          diffX = minLeft - elmX;
          mOffX = dX - diffX;
        }
        elmX += diffX;
        elmW -= diffX;
      }
      if (hClass.indexOf('e') >= 0) {
        if (elmW + dX < getMinWidth()) {
          diffX = getMinWidth() - elmW;
          mOffX = dX - diffX;
        } else if (elmX + elmW + dX > maxLeft) {
          diffX = maxLeft - elmX - elmW;
          mOffX = dX - diffX;
        }
        elmW += diffX;
      }

      // set new position
      item.$el.style.top = elmY + 'px';
      item.$el.style.left = elmX + 'px';
      item.$el.style.width = elmW + 'px';
      item.$el.style.height = elmH + 'px';

      resize(e);

      return true;
    }

    function mouseUp(e) {
      // restore draggable setting to its original state
      if (item.gridster.draggable.enabled !== savedDraggable) {
        item.gridster.draggable.enabled = savedDraggable;
        item.gridster.$emit('gridster-draggable-changed', item.gridster);
      }

      mOffX = mOffY = 0;

      resizeStop(e);

      return true;
    }

    var $dragHandle = null;
    var unifiedInput;

    this.enable = function() {
      if (!$dragHandle) {
        $dragHandle = document.createElement("div");
        $dragHandle.classList.add("gridster-item-resizable-handler");
        $dragHandle.classList.add("handle-" + hClass);
        item.$el.append($dragHandle);
      }

      unifiedInput = new GridsterTouch($dragHandle, mouseDown, mouseMove, mouseUp);
      unifiedInput.enable();
    };

    this.disable = function() {
      if ($dragHandle) {
        $dragHandle.remove();
        $dragHandle = null;
      }

      unifiedInput.disable();
      unifiedInput = undefined;
    };

    this.destroy = function() {
      this.disable();
    };
  }

  var handles = [];
  var handlesOpts = item.gridster.resizable.handles;
  if (typeof handlesOpts === 'string') {
    handlesOpts = item.gridster.resizable.handles.split(',');
  }
  var enabled = false;

  for (var c = 0, l = handlesOpts.length; c < l; c++) {
    handles.push(new ResizeHandle(handlesOpts[c]));
  }

  this.enable = function() {
    if (enabled) {
      return;
    }
    for (var c = 0, l = handles.length; c < l; c++) {
      handles[c].enable();
    }
    enabled = true;
  };

  this.disable = function() {
    if (!enabled) {
      return;
    }
    for (var c = 0, l = handles.length; c < l; c++) {
      handles[c].disable();
    }
    enabled = false;
  };

  this.toggle = function(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  };

  this.destroy = function() {
    for (var c = 0, l = handles.length; c < l; c++) {
      handles[c].destroy();
    }
  };
}
