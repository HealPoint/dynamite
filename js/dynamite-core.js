function namespace(namespaceString) {
    var parts = namespaceString.split('.'),
        parent = window,
        currentPart = '';    
        
    for(var i = 0, length = parts.length; i < length; i++) {
        currentPart = parts[i];
        parent[currentPart] = parent[currentPart] || {};
        parent = parent[currentPart];
    }
    
    return parent;
}

var core = namespace('dynamite.core');

core.Point = Base.extend({
	constructor: function(x, y) {
		this.x = x;
		this.y = y;
	},

	toString: function() {
		return "(" + this.x + ", " + this.y + ")";
	}

});

core.ODEPlanarSystem = Base.extend({
    constructor: function() {
    },

    evaluate: function(x, y, t) {
        alert('evaluate() not implemented!');
    }
});

core.ODEParsedSystem = core.ODEPlanarSystem.extend({
    /* dx_dt & dy_dt are expressions, not callbacks */
    constructor: function(dx_dt, dy_dt) {
        this.base();
        this.dx_dt = dx_dt;
        this.dy_dt = dy_dt;

        this.dx_dtCallback = dx_dt.toJSFunction(['x', 'y', 't']);
        this.dy_dtCallback = dy_dt.toJSFunction(['x', 'y', 't']);
    },

    evaluate: function(x, y, t) {
        return new core.Point(this.dx_dtCallback(x,y,t), this.dy_dtCallback(x,y,t));
    },

    toString: function() {
        return 'dx/dt = ' + this.dx_dt.formula + '; ' + 'dy/dt = ' + this.dy_dt.formula;
    }
});

integrators = namespace('dynamite.core.integrators');

integrators.ODEIntegrator = Base.extend({
    constructor: function() {
        this.ti = 0.0;
        this.tf = 5.0;
        this.step = 0.01;
        // this.iterations = 1000;
    },

    setStepSize: function(stepSize) {
        if (stepSize <= 0.0 || !stepSize)
            return;

        this.step = stepSize;
    },

    setInterval: function(ti, tf) {
        if (ti)
            this.ti = ti;

        if (tf)
            this.tf = tf;
    },

    solve: function(system, p0) {
        alert('solve() not implemented!');
    }
});

integrators.RungeKutta4 = integrators.ODEIntegrator.extend({
    constructor: function() {
        this.base();
    },

    solve: function(system, p0) {
        var sol = [];

        var H = this.step;
        
        sol.push(p0);

        var xval = p0.x;
        var yval = p0.y;
        var tval = this.ti;

        for (var n = 0; true; n++) {
            if (tval > this.tf)
                break;

            var e = system.evaluate(xval, yval, tval);

            var L1 = e.x;
            var M1 = e.y;
            
            var x1 = xval + H*L1/2;
            var y1 = yval + H*M1/2;
            var t1 = tval + H/2;

            e = system.evaluate(x1, y1, t1);
            var L2 = e.x;
            var M2 = e.y;
            x1 = xval + H*L2/2;
            y1 = yval + H*M2/2;

            e = system.evaluate(x1, y1, t1);
            var L3 = e.x;
            var M3 = e.y;

            x1 = xval + H*L3;
            y1 = yval + H*M3;
            tval = tval + H;

            e = system.evaluate(x1, y1, tval);
            var L4 = e.x;
            var M4 = e.y;

            xval = xval + H*(L1+2*L2+2*L3+L4)/6;
            yval = yval + H*(M1+2*M2+2*M3+M4)/6;

            sol.push(new dynamite.core.Point(xval, yval));
        }

        return sol;
    }
});