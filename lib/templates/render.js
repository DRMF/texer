// Render an AST.
"use strict";

var ast = require('./ast');

ast.RenderT.defineVisitor("tex_part", {
    HTMLABLE: function(_,t,_2) { return t; },
    HTMLABLEM: function(_,t,_2) { return t; },
    HTMLABLEC: function(_,t,_2) { return t; },
    MHTMLABLEC: function(_,t,_2,_3,_4) { return t; },
    HTMLABLE_BIG: function(t,_) { return t; },
    TEX_ONLY: function(t) { return t; }
});


var render = module.exports = function render(e) {
    if (Array.isArray(e)) {
        return e.map(render).join('');
    }
    return e.render_tex();
};

var curlies = function(t, optional, alpha) {
    if (optional == null) {
        optional = true;
    }
    if (alpha == null) {
        alpha = true;
    }
    switch (t.constructor) {
    // constructs which are surrounded by curlies
    case ast.Tex.CURLY:
        t = t.render_tex();
        if (t.charAt(0) !== "{" || t.charAt(t.length - 1) !== "}") {
            t = "{" + t + "}";
        }
        return t;
    case ast.Tex.MATRIX:
        return t.render_tex();
    case String:
        break;
    default:
        t = t.render_tex();
    }
    if (!optional || (alpha && t.match(/^[a-zA-Z]/))) {
        return "{" + t + "}";
    }
    else {
        return t;
    }
};

var render_curlies = function(a, optional, alpha) {
    if (a.length === 1) {
        return curlies(a[0], optional, alpha);
    }
    return curlies(render(a), optional, alpha);
};

ast.Tex.defineVisitor("render_tex", {
    FQ: function(base, down, up) {
        return base.render_tex() + "_" + curlies(down, true, false) + "^" + curlies(up, true, false);
    },
    DQ: function(base, down) {
        return base.render_tex() + "_" + curlies(down, true, false);
    },
    UQ: function(base, up) {
        return base.render_tex() + "^" + curlies(up, true, false);
    },
    FQN: function(down, up) {
        return "_" + curlies(down, true, false) + "^" + curlies(up, true, false);
    },
    DQN: function(down) {
        return "_" + curlies(down, true, false);
    },
    UQN: function(up) {
        return "^" + curlies(up, true, false);
    },
    JACOBI: function(a, b, c, d) {
        return "\\Jacobi" + curlies(a, false) + curlies(b, false) + curlies(c, false) + "@" + curlies(d, false);
    },
    LAGUERRE1: function(a, b) {
        return "\\Laguerre" + curlies(a, false) + "@" + curlies(b, false);
    },
    LAGUERRE2: function(a, b, c) {
        return "\\Laguerre" + curlies(a, false) + "[" + b.render_tex() + "]" + "@" + curlies(c, false);
    },
    EJACOBI: function(a, b, c) {
        return "\\Jacobi" + a + "@" + curlies(b, false) + curlies(c, false);
    },
    LITERAL: function(r) {
        return r.tex_part();
    },
    PAREN1: function(f, a) {
        return f + "@" + curlies(a);
    },
    PAREN2: function(f, a) {
        return f + "@@" + curlies(a);
    },
    QPOCH: function(a, b, c) {
        return "\\qPochhammer" + curlies(a, false) + curlies(b, false) + curlies(c, false);
    },
    POCH: function(a, b) {
        return "\\pochhammer" + curlies(a, false) + curlies(b, false);
    },
    FUN1: function(f, a) {
        return f + curlies(a);
    },
    FUN1nb: function(f, a) {
        return f + curlies(a);
    },
    DECLh: function(f, _, a) {
        return f + render_curlies(a);
    },
    FUN2: function(f, a, b) {
        return f + curlies(a) + curlies(b);
    },
    FUN2nb: function(f, a, b) {
        return f + curlies(a) + curlies(b);
    },
    FUN2sq: function(f, a, b) {
        return f + "[" + a.render_tex() + "]" + curlies(b);
    },
    FUN3: function(f, a, b, c) {
        return f + curlies(a) + curlies(b) + curlies(c);
    },
    CURLY: function(tl) {
        return render_curlies(tl, false);
    },
    INFIX: function(s, ll, rl) {
        return curlies(render(ll) + " " + s + " " + render(rl));
    },
    BOX: function(bt, s) {
        return bt + curlies(s);
    },
    BIG: function(bt, d) {
        return bt + " " + d.tex_part();
    },
    MATRIX: function(t, m) {
        var render_line = function(l) { return l.map(render).join('&'); };
        var render_matrix = function(m) { return m.map(render_line).join('\\\\'); };
        return curlies("\\begin{"+t+"}" + render_matrix(m) + "\\end{"+t+"}");
    },
    MULTLINE: function(t, m) {
        var render_lines = function(l) { return l.map(render).join('\\\\'); };
        return "\\begin{"+t+"}" + render_lines(m) + "\\end{"+t+"}";
    },
    LR: function(l, r, tl) {
        return "\\left" + l.tex_part() + render(tl) + "\\right" + r.tex_part();
    }
});
