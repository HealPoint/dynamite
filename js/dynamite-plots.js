var plots = namespace('dynamite.plots');

plots.utils = {
	/* Taken from http://michael.verhov.com/Download/arrows.js */
	drawArrow: function(context, fromx, fromy, tox, toy, headlen) {
	    var headlen = (typeof(headlen) == 'undefined' || !headlen ) ? 8 : headlen;
	    var dx = tox - fromx;
	    var dy = toy - fromy;
	    var angle = Math.atan2(dy, dx);
	    context.beginPath();
	    context.moveTo(fromx, fromy);
	    context.lineTo(tox, toy);    
	    context.moveTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
	    context.lineTo(tox, toy);
	    context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
	    context.stroke();
	},

	drawGridLines: function(c, direction, start, step, maxWidth, maxHeight, includeFirst, gridColor) {
		c.strokeStyle = gridColor;
		
		c.beginPath();

		if (direction == 'vertical') {
			var x = includeFirst ? start : start + step;

			while (step < 0 ? x >= 0 : x <= maxWidth) {
				c.moveTo(x, 0);
				c.lineTo(x, maxHeight);

				x += step;
			}
		} else if (direction == 'horizontal') {
			var y = includeFirst ? start : start + step;

			while (step < 0 ? y >= 0 : y <= maxHeight) {
				c.moveTo(0, y);
				c.lineTo(maxWidth, y);

				y += step;				
			}
		}

		c.stroke();
	},

	drawTicks: function(c, direction, startX, startY, step, maxLength, includeFirst, tickLength, color) {
		c.strokeStyle = color;

		c.beginPath();

		if (direction == 'horizontal') {
			var x = includeFirst ? startX : startX + step;

			while (step < 0 ? x >= 0 : x <= maxLength) {
				c.moveTo(x, startY - tickLength);
				c.lineTo(x, startY + tickLength);
				x += step;
			}
		} else if (direction=='vertical') {
			var y = includeFirst ? startY : startY + step;

			while (step < 0 ? y >= 0 : y <= maxLength) {
				c.moveTo(startX - tickLength, y);
				c.lineTo(startX + tickLength, y);
				y += step;
			}			
		}

		c.stroke();
	},

};

plots.PlotModel = Base.extend({
	constructor: function() {
		this.lastID = 0;
		this.plots = {};
		this.plotSelection = []; /* only hashes */
		this.listeners = {};
	},

	add: function(plot) {
		plot.addChangeListener(function(){
			this.fireEvent('change', [this]);
		}.bind(this));

		this.plots[this.lastID] = plot;
		this.fireEvent('add', [plot, this.lastID]);
		this.fireEvent('change', [this]);

		this.lastID++;
	},

	remove: function(plot) {
		var hash = this.findHash(plot);

		if (hash == -1)
			return;

		var index = this.plotSelection.indexOf(hash);
		if (index >= 0) {
			this.selectPlot(hash, 'hash', true);
			// this.plotSelection.splice(index, 1);
		}

		delete this.plots[hash];

		this.fireEvent('delete', [plot, hash]);
		this.fireEvent('change', [this]);
	},

	addListener: function(eventName, callback, context) {
		if (!(eventName in this.listeners)) this.listeners[eventName] = [];

		if ( typeof(context) == 'undefined' || !context )
			context = false;

		this.listeners[eventName].push([callback, context]);
	},

	fireEvent: function(eventName, args) {
		if (!(eventName in this.listeners)) this.listeners[eventName] = [];

		for (var i = 0; i < this.listeners[eventName].length; i++) {
			var listenerData = this.listeners[eventName][i];
			listenerData[0].apply(listenerData[1] ? listenerData[1] : this, args);
		}
	},

	each: function(callback, sorted) {
		if (typeof(callback) == 'undefined' || !callback)
			return;

		if (typeof(sorted) == 'undefined')
			sorted = true;

		var plots = [];
		var keys = Object.keys(this.plots);
		for (var i = 0; i < keys.length; i++) {
			plots.push(this.plots[keys[i]]);
		}

		if (sorted) {
			// plots = this.plots.slice();
			plots.sort(function(a,b){ return a.priority - b.priority });
		} else {
			// plots = this.plots;	
		}

		for (var i = 0; i < plots.length; i++) {
			callback(plots[i], i);
		}
	},

	findPlot: function(hash) {
		if (!(hash in this.plots))
			return null;

		return this.plots[hash];
	},

	findHash: function(plot) {
		var keys = Object.keys(this.plots);

		for (var i = 0; i < keys.length; i++) {
			if (this.plots[keys[i]] == plot)
				return keys[i];
		}

		return -1;
	},

	selectPlot: function(data, mechanism, toggle) {
		if (mechanism != 'hash') // TODO
			return;

		if (typeof(toggle) == 'undefined') toggle = false;

		var previousSelection = this.plotSelection.slice();
		var index = this.plotSelection.indexOf(data);

		if (index >= 0) {
			if (toggle) {
				this.plotSelection = [];
			}
		} else {
			this.plotSelection = [data];
		}

		this.fireEvent('selectionChanged', [previousSelection, this.plotSelection]);
		this.fireEvent('change', [this]);
	},

	clearSelection: function() {
		var previousSelection = this.plotSelection.slice();
		this.plotSelection = [];

		this.fireEvent('selectionChanged', [previousSelection, this.plotSelection]);
		this.fireEvent('change', [this]);
	},

	getPlotSelection: function() {
		var selection = [];

		for (var i = 0; i < this.plotSelection.length; i++) {
			selection.push(this.plots[this.plotSelection[i]]);
		}

		return selection;
	},

	// setSelection: function(selection, mechanism) {
	// 	if (mechanism != 'hash') // TODO
	// 		return;

	// 	var previousSelection = this.plotSelection.slice();
	// 	this.plotSelection = [];

	// 	for (var i = 0; i < selection.length; i++) {
	// 		this.plotSelection.push(selection[i]);
	// 	}

	// 	console.log(previousSelection, this.plotSelection);

	// 	this.fireEvent('selectionChanged', [previousSelection, this.plotSelection]);
	// },

	refresh: function() {
		this.fireEvent('change', [this]);
	}

});

plots.Plot = Base.extend({
	constructor: function() {
		this.settings = { lineWidth: 1.5, lineColor: '#000' };
		this.enabled = true;
		this.priority = 0;
		this.listeners = [];
	},

	compute: function(dContext) {
		return;
	},

	paint: function(c, dContext) {
		alert('paint() is undefined!');
	},

	toString: function() {
		return 'Plot';
	},

	addChangeListener: function(callback, data) {
		this.listeners.push([callback,data]);
	},

	emitChange: function() {
		for (var i = 0; i < this.listeners.length; i++) {
			var listener = this.listeners[i];
			listener[0].apply(this, [listener[1]]);
		}
	},

	set: function(setting, value) {
		if (setting in this.settings) {
			this.settings[setting] = value;
			this.emitChange();
			return true;
		}

		return false;
	},

	get: function(setting) {
		return (setting in this.settings) ? this.settings[setting] : null;
	},

	getSettingsProfile: function() {
		return 'Plot';
	},

});

// Coordinate axes
plots.CoordinateAxes = plots.Plot.extend({
	constructor: function() {
		this.base();

		this.settings['lineWidth'] = '1.5';
		this.settings['lineColor'] = '#000';
		this.settings['gridColor'] = '#eee';
		this.settings['showLines'] = true;
		this.settings['showGrid'] = true;
		this.settings['showLabels'] = true;
		this.settings['drawTicks'] = true;
		this.settings['tickLength'] = 4;
		this.settings['labelFontSize'] = 11;
		this.settings['labelOffset'] = this.settings.tickLength + 3;

		this.priority = -1;
	},

	calculateStep: function(dContext, axis) {
		var realStep = (dContext.view[1].x - dContext.view[0].x) / 10.0;
		var pixelStep = Math.abs(dContext.pointToPixel(new dynamite.core.Point(realStep, 0.0)).x - dContext.pointToPixel(new dynamite.core.Point(0.0, 0.0)).x);

		if (typeof(axis) == 'undefined' || !axis)
			axis = 'x';

		if ( axis == 'y' ) {
			pixelStep = Math.abs(dContext.pointToPixel(new dynamite.core.Point(0.0, realStep)).y - dContext.pointToPixel(new dynamite.core.Point(0.0, 0.0)).y);
			return pixelStep;
		}

		return pixelStep;
	},

	// TODO: determine precision based on view range
	// TODO: make this more abstract and avoid so many specifics in the loops (move stuff to utils)
	drawLabels: function(c, dContext, stepX, stepY) {
		var o = dContext.pointToPixel(new dynamite.core.Point(0.0, 0.0));

		c.font = this.settings.labelFontSize + 'px sans-serif';

		// horizontal
		c.textBaseline = 'top';
		c.textAlign = 'center';

		var step = stepX;
		for (var x = o.x - step; x >= 0; x -= step) {
			var tickText = (dContext.pixelToPoint(new dynamite.core.Point(x, 0.0)).x).toFixed(2);
			var y;
			if (o.y + this.settings.labelFontSize <= 0)
				y = this.settings.labelOffset;
			else if (o.y - this.settings.labelFontSize >= dContext.height)
				y = dContext.height - this.settings.labelFontSize - this.settings.labelOffset;
			else
				y = o.y + this.settings.labelOffset;

			c.fillText(tickText, x, y, step);
		}

		for (var x = o.x + step; x <= dContext.width; x += step) {
			var tickText = (dContext.pixelToPoint(new dynamite.core.Point(x, 0.0)).x).toFixed(2);
			var y;

			if (o.y + this.settings.labelFontSize <= 0)
				y = this.settings.labelOffset;
			else if (o.y - this.settings.labelFontSize >= dContext.height)
				y = dContext.height - this.settings.labelFontSize - this.settings.labelOffset;
			else
				y = o.y + this.settings.labelOffset;

			c.fillText(tickText, x, y, step - (2 * this.settings.labelOffset));
		}

		// vertical
		step = stepY;

		c.textBaseline = 'middle';
		c.textAlign = 'left';
		for (var y = o.y - step; y >= 0; y -= step) {
			var tickText = (dContext.pixelToPoint(new dynamite.core.Point(0.0, y)).y).toFixed(2);
			var x;
			var textWidth = c.measureText(tickText).width;

			if (o.x + textWidth <= 0)
				x = this.settings.labelOffset;
			else if (o.x - textWidth >= dContext.width)
				x = dContext.width - textWidth - this.settings.labelOffset;
			else
				x = o.x + this.settings.labelOffset;

			c.fillText(tickText, x, y, step);
		}

		for (var y = o.y + step; y <= dContext.height; y += step) {
			var tickText = (dContext.pixelToPoint(new dynamite.core.Point(0.0, y)).y).toFixed(2);
			var x;
			var textWidth = c.measureText(tickText).width;

			if (o.x + textWidth <= 0)
				x = this.settings.labelOffset;
			else if (o.x - textWidth >= dContext.width)
				x = dContext.width - textWidth - this.settings.labelOffset;
			else
				x = o.x + this.settings.labelOffset;

			c.fillText(tickText, x, y, step);
		}				

	},

	paint: function(c, dContext) {
		var o = dContext.pointToPixel(new dynamite.core.Point(0.0, 0.0));
		var stepX = this.calculateStep(dContext, 'x');
		var stepY = this.calculateStep(dContext, 'y')

		if (this.settings.showGrid) {
			plots.utils.drawGridLines(c, 'vertical', o.x, -stepX, dContext.width, dContext.height, false, this.settings.gridColor);
			plots.utils.drawGridLines(c, 'vertical', o.x, stepX, dContext.width, dContext.height, false, this.settings.gridColor);
			plots.utils.drawGridLines(c, 'horizontal', o.y, -stepY, dContext.width, dContext.height, false, this.settings.gridColor);
			plots.utils.drawGridLines(c, 'horizontal', o.y, stepY, dContext.width, dContext.height, false, this.settings.gridColor);
		}

		if (this.settings.showLines) {
			c.strokeStyle = this.settings.lineColor;
			plots.utils.drawArrow(c, 0, o.y, dContext.width, o.y); // x axis

			if ( this.settings.drawTicks ) {
				plots.utils.drawTicks(c, 'horizontal', o.x, o.y, stepX, dContext.width, false, this.settings.tickLength, this.settings.lineColor);
				plots.utils.drawTicks(c, 'horizontal', o.x, o.y, -stepX, dContext.width, false, this.settings.tickLength, this.settings.lineColor);
				plots.utils.drawTicks(c, 'vertical', o.x, o.y, stepY, dContext.height, false, this.settings.tickLength, this.settings.lineColor);
				plots.utils.drawTicks(c, 'vertical', o.x, o.y, -stepY, dContext.height, false, this.settings.tickLength, this.settings.lineColor);
			}

			plots.utils.drawArrow(c, o.x, dContext.height, o.x, 0); // y axis			
		}

		if (this.settings.showLabels) {
			this.drawLabels(c, dContext, stepX, stepY);
		}

	},

	getSettingsProfile: function() {
		return 'Axes';
	},

	toString: function() {
		return 'CoordinateAxes';
	}

});

plots.FunctionPlot = plots.Plot.extend({
	constructor: function(expression) {
		this.base();
		
		this.expression = expression;
		this.evalCallback = expression.toJSFunction(['x']);
		this.dataset = [];
	},

	compute: function(dContext) {
		var step = 1.0 / dContext.getScaleX();
		this.dataset = [];

		for (var x = dContext.view[0].x; x <= dContext.view[1].x; x += step) {
			this.dataset.push(new dynamite.core.Point(x, this.evalCallback(x)));
		}
	},

	paint: function(c, dContext) {
		var first = true;

		c.beginPath();

		for (var i = 0; i < this.dataset.length; i++) {
			pixel = dContext.pointToPixel(this.dataset[i]);

			if ( first ) {
				c.moveTo(pixel.x, pixel.y);
				first = false;
			} else {
				c.lineTo(pixel.x, pixel.y);
			}
		}

		c.stroke();
	},

	toString: function() {
		return 'y = ' + this.expression.formula.toString();
	}
});


/* Differential Equations */

// Slope Field
plots.SlopeField = plots.Plot.extend({
	constructor: function(system) {
		this.base();
		this.system = system;
		this.priority = 5;

		this.settings['lineColor'] = 'blue';
		this.settings['density'] = 10.0;
		this.settings['useArrows'] = false;
	},

	paint: function(c, dContext) {
		var h = dContext.width / this.settings.density;
		var k = dContext.height / this.settings.density;

		var p1 = dContext.pixelToPoint(new dynamite.core.Point(h, k));
		var p2 = dContext.pixelToPoint(new dynamite.core.Point(2 * h, 2 * k));
		var a = p2.x - p1.x;
		var b = p2.y - p1.y;

		var N = Math.sqrt(a*a + b*b);

		var x = h;

		
		if (!this.settings.useArrows)
			c.beginPath();

		while (x <= dContext.width) {
			var y = k;

			while (y <= dContext.height) {
				var point = dContext.pixelToPoint(new dynamite.core.Point(x, y));
				var fPoint = this.system.evaluate(point.x, point.y, 0.0);

				var L = fPoint.x;
				var M = fPoint.y;

				var Mod = 4.0 * Math.sqrt(L*L + M*M);

				var q1 = dContext.pointToPixel(new dynamite.core.Point(point.x + L * N/Mod, point.y + M * N / Mod));
				var q2 = dContext.pointToPixel(new dynamite.core.Point(point.x, point.y));

				if (this.settings.useArrows) {
					plots.utils.drawArrow(c, q2.x, q2.y, q1.x, q1.y, 4);
				} else {
					c.moveTo(q2.x, q2.y);
					c.lineTo(q1.x, q1.y);
				}

				y = y + k;
			}

			x = x + h;
		}

		if (!this.settings.useArrows)
			c.stroke();
	},

	getSettingsProfile: function() {
		return 'SlopeField';
	},

	toString: function() {
		return this.system.toString();
	}

});

// Orbit Plot
plots.OrbitPlot = plots.Plot.extend({
	constructor: function(system, initialPoint) {
		this.base();
		this.system = system;
		this.initialPoint = initialPoint;
		this.priority = 10;

		this.settings.showInitialPoint = false;
		//this.settings.lineColor = '#ff0000';
		this.settings.solver = 'RungeKutta4';
		this.settings.solverStepSize = 0.01;
		this.settings.solverTF = 5.0;

		this.solution = [];
	},

	compute: function(dContext) {
		var solver = new dynamite.core.integrators.RungeKutta4();
		solver.setStepSize(this.settings.solverStepSize);
		solver.setInterval(null, this.settings.solverTF);
		this.solution = solver.solve(this.system, this.initialPoint);
	},

	paint: function(c, dContext) {
		var dataset = this.solution;

		c.beginPath();

		var first = true;
		for (var i = 0; i < dataset.length; i++) {
			var pixel = dContext.pointToPixel(dataset[i]);

			if ( first ) {
				// draw initial point a little bigger
				if ( this.settings.showInitialPoint ) {
					c.fillStyle = this.settings.lineColor;
					c.arc(pixel.x, pixel.y, 2.5, 0, 2*Math.PI);
					c.fill();
				}

				c.moveTo(pixel.x, pixel.y);
				first = false;
			} else {
				c.lineTo(pixel.x, pixel.y);
			}
		}

		c.stroke();
	},

	getSettingsProfile: function() {
		return 'OrbitPlot';
	},

	toString: function() {
		return this.system.toString() + ' x0 = ' + this.initialPoint.toString();
	}

});

// Julia Set plot
plots.JuliaSetPlot = plots.Plot.extend({
	constructor: function(c) {
		this.base();
		this.c = this.complex(c.x, c.y);
		this.dataset = [];

		this.settings.iterations = 50;
		this.settings.tolerance = 2.0;
	},

	complex: function(x, y) {
		var ComplexNumber = function(a, b) {
			this.a = a;
			this.b = b;
		};

		ComplexNumber.prototype.add_ = function(z) {
			return new ComplexNumber( this.a + z.a, this.b + z.b );
		};

		ComplexNumber.prototype.mult = function(z) {
			return new ComplexNumber( (this.a * z.a) - (this.b * z.b), (this.a * z.b) + (this.b * z.a) );
		};

		ComplexNumber.prototype.abs = function() {
			return Math.sqrt( this.a * this.a + this.b * this.b );
		};

		ComplexNumber.prototype.asPoint = function() {
			return new dynamite.core.Point(this.a, this.b);
		},

		ComplexNumber.prototype.toString = function() {
			return this.a + ' + ' + this.b + 'i';
		};

		return new ComplexNumber(x, y);
	},

	compute: function(dContext) {
		var dataset = [];
		var h = 0.005;
		
		var x = 0;
		var y = 0;
		var z = null;

		x = dContext.view[0].x;

		while (x <= dContext.view[1].x) {
			y = dContext.view[0].y;

			while (y <= dContext.view[1].y) {
				n = 0;
				z = this.complex(x, y);

				while ( n < (this.settings.iterations - 1) && z.abs() < this.settings.tolerance ) {
					z = z.mult(z).add_(this.c);
					n += 1;
				}

				if (z.abs() < this.settings.tolerance) {
					dataset.push(new dynamite.core.Point(x,y));
				}

				y += h;
			}

			x += h;
		}	

		this.dataset = dataset;
	},

	paint: function(c, dContext) {
		var dataset = this.dataset;
		
		c.fillStyle = this.settings.lineColor;
		// var img = c.createImageData(dContext.width, dContext.height);

		for (var i = 0; i < dataset.length; i++) {
			var p = dContext.pointToPixel(dataset[i]);

			c.beginPath();
			c.arc(p.x, p.y, 0.8, 0, 2*Math.PI);
			c.fill();
		// 	// this.pixel(img, ~~p.x, ~~p.y, 0, 0, 0, 255);
		}
		

		// c.putImageData(img, 0, 0);
	},

	pixel: function(imageData, x, y, r, g, b, a) {
	    index = (x + y * imageData.width) * 4;
	    imageData.data[index+0] = r;
	    imageData.data[index+1] = g;
	    imageData.data[index+2] = b;
	    imageData.data[index+3] = a;
	},

	getSettingsProfile: function() {
		return 'JuliaSetPlot';
	},

	toString: function() {
		return 'Julia Set: c = ' + this.c.toString();
	}

});
