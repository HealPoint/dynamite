var canvas = namespace('dynamite.canvas');

var Point = dynamite.core.Point;

canvas.CanvasContext = Base.extend({
	constructor: function(view, width, height) {
		this.view = view;
		this.width = width;
		this.height = height;
	},

	setView: function(view) {
		this.view = view;
	},

	setSize: function(width, height) {
		if ( width > 0)
			this.width = width;

		if (height > 0)
			this.height = height;
	},

	getScaleX: function() {
		return this.width / ( this.view[1].x - this.view[0].x );
	},

	getScaleY: function() {
		return this.height / ( this.view[1].y - this.view[0].y );
	},	

	pointToPixel: function(p) {
		var x = ( p.x - this.view[0].x ) * ( this.width / ( this.view[1].x - this.view[0].x ) );
		var y = this.height - ( p.y - this.view[0].y ) * ( this.height / ( this.view[1].y - this.view[0].y ) );
		
		return new Point(x, y);
	},

	pixelToPoint: function(p) {
		var o = this.pointToPixel(new Point(0.0, 0.0));

		var x = ( p.x - o.x ) * ( ( this.view[1].x - this.view[0].x ) / this.width );
		// var y = ( this.height - p.y - o.y ) * ( ( this.view[1].y - this.view[0].y ) / this.height );
		var y = ( p.y - o.y ) * ( ( this.view[1].y - this.view[0].y ) / -this.height );		

		return new Point(x, y);
	}

});

canvas.Canvas = Base.extend({
	constructor: function(htmlCanvas, model) {
		htmlCanvas.style.background = '#fff';

		this.canvas = htmlCanvas;

		this.width = htmlCanvas.width;
		this.height = htmlCanvas.height;

		this.view = [new Point(-5.0, -3.0), new Point(5.0, 3.0)]; 	// [(x0,y0), (x1,y1)]
		this.cursorPos = null;
		this.cursorCoords = null;
		this.origin = new Point(0.0, 0.0);

		this.canvasContext = new dynamite.canvas.CanvasContext(this.view, this.width, this.height);

		if ( typeof(model) == 'undefined' || !model )
			this.setModel(new dynamite.plots.PlotModel());
		else
			this.setModel(model);

		this.model.add(new dynamite.plots.CoordinateAxes());

		this.dragStart = null;
		this.dragging = false;
		this.mouseIsDown = false;

		this._setupListeners();
	},

	_setupListeners: function() {
		var thisCanvas = this;

		this.canvas.addEventListener('mousemove', function(e) {
			if ( thisCanvas.mouseIsDown ) {
				thisCanvas.dragging = true;
				thisCanvas.canvas.style.cursor = 'move';
			}

			var rect = thisCanvas.canvas.getBoundingClientRect();
			thisCanvas.cursorPos = new Point(e.clientX - rect.left, e.clientY - rect.top);
			thisCanvas.cursorCoords = thisCanvas.canvasContext.pixelToPoint(thisCanvas.cursorPos);

			if ( thisCanvas.dragging && thisCanvas.dragStart ) {
				var dragPoint = thisCanvas.canvasContext.pixelToPoint(thisCanvas.dragStart);
				var dragEndPoint = thisCanvas.cursorCoords;

				thisCanvas.view[0].x = thisCanvas.view[0].x - dragEndPoint.x + dragPoint.x;
				thisCanvas.view[1].x = thisCanvas.view[1].x - dragEndPoint.x + dragPoint.x;
				thisCanvas.view[0].y = thisCanvas.view[0].y - dragEndPoint.y + dragPoint.y;
				thisCanvas.view[1].y = thisCanvas.view[1].y - dragEndPoint.y + dragPoint.y;

				thisCanvas.canvasContext.view = thisCanvas.view;

				thisCanvas.requestRepaint();

				thisCanvas.dragStart = thisCanvas.cursorPos;
				return;
			}

			thisCanvas.requestRepaint();
		}, false);

		/* Zooming with mouse wheel */
		var handleMouseWheel = function(e) {
			var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
			
			if ( delta > 0 ) {
				thisCanvas.zoomIn();
			} else {
				thisCanvas.zoomOut();
			}
		};

		this.canvas.addEventListener('mousewheel', handleMouseWheel, false);
		this.canvas.addEventListener('DOMMouseScroll', handleMouseWheel, false);

		/* Drag */
		this.canvas.addEventListener('mousedown', function(e) {
			if ( e.button != 0)
				return;

			thisCanvas.mouseIsDown = true;

			var rect = thisCanvas.canvas.getBoundingClientRect();
			thisCanvas.dragStart = new Point(e.clientX - rect.left, e.clientY - rect.top);
		}, false);
		this.canvas.addEventListener('mouseup', function(e) {
			thisCanvas.mouseIsDown = false;

			if ( thisCanvas.dragging ) {
				thisCanvas.canvas.style.cursor = 'auto';
				thisCanvas.dragging = false;
			}

		}, false);
	},

	/* Zoom */
	zoomIn: function(factor) {
		if ( typeof(factor) == 'undefined' || !factor )
			factor = 1.1;
		
		this.zoom(1.0 / factor);
	},

	zoomOut: function(factor) {
		if ( typeof(factor) == 'undefined' || !factor )
			factor = 1.1;

		this.zoom(factor);
	},

	zoom: function(factor, position) {
		var viewWidth = this.view[1].x - this.view[0].x;
		var viewHeight = this.view[1].y - this.view[0].y;
		var viewCX = this.view[0].x + viewWidth / 2.0;
		var viewCY = this.view[0].y + viewHeight / 2.0;

		viewWidth *= factor;
		viewHeight *= factor;

		this.view[0].x = viewCX - viewWidth / 2.0;
		this.view[1].x = viewCX + (viewWidth / 2.0);
		this.view[0].y = viewCY - viewHeight / 2.0;
		this.view[1].y = viewCY + (viewHeight / 2.0);

		this.canvasContext.view = this.view;
		this.requestRepaint();
	},

	setModel: function(model) {
		this.model = model;

		model.addListener('change', function(){
			this.requestRepaint();	
		}, this);

		this.requestRepaint();
	},

	getModel: function() {
		return this.model;
	},

	_paintCursorPosition: function(c, dContext) {
		if ( !this.cursorCoords )
			return;

		var xCoord = this.cursorCoords.x;
		var yCoord = this.cursorCoords.y;

		c.font = '10px';
		c.fillStyle = 'black';
		c.fillText('(' + xCoord + ',' + yCoord + ') // [' + this.view[0].x  + ',' + this.view[1].x + ']x[' + this.view[0].y + ',' + this.view[1].y + ']' , 10, 20);
	},

	requestRepaint: function() {
		this.repaint();
	},

	repaint: function() {
		var c = this.canvas.getContext('2d');
		c.clearRect(0, 0, this.width, this.height);

		c.save();
		this._paintCursorPosition(c, this.canvasContext);
		c.restore();

		var selectedPlots = this.model.getPlotSelection();

		this.model.each(function(plot){
			if (!plot.enabled)
				return;

			if (!this.dragging ) // do not compute hard stuff while dragging
				plot.compute(this.canvasContext);

			c.save();
			c.strokeStyle = plot.settings.lineColor;
			c.lineWidth = plot.settings.lineWidth;

			if (selectedPlots.length > 0) {
				if (selectedPlots.indexOf(plot) == -1) {
					c.globalAlpha = 0.3;
				} else {
					c.globalApha = 1.0;
				}
			}

			plot.paint(c, this.canvasContext);

			c.restore();
		}.bind(this));
	}

});