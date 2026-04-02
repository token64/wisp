var levelsEnum = (function() {
	"use strict";
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var LevelsEnum = function LevelsEnum() {
		_classCallCheck(this, LevelsEnum);
		this.NIVEL_ADMINISTRADOR = 3;
		this.NIVEL_TECNICO = 2;
		this.NIVEL_COMERCIAL = 4;
		this.NIVEL_MONITOR = 5;
		this.NIVEL_VIEW = 1;
        this.NIVEL_VIEWEXPORT = 6;
		Object.seal(this);
	};

	return LevelsEnum;
})();
