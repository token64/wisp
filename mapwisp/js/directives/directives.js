app.directive("ccSpinner",function(){
	return {
		 template: "<span us-spinner=\"{radius:8,width:5,length:3,lines:9}\"></span>",
		 restrict : "E"
	};
});

app.directive("ccSpinnerSmall",function(){
    return {
         template: "<span us-spinner=\"{radius:4,width:3,length:3,lines:6}\"></span>",
         restrict : "E"
    };
});

//função para o envento de click direito do mouse sobre um elemento
app.directive("ngRightClick", function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind("contextmenu", function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

app.directive("ngEnter", [function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function (){
                    scope.$eval(attrs.ngEnter);
                });
                event.preventDefault();
            }
        });
    };
}]);

app.directive("resize", function ($window) {
    return function (scope, element) {
        var w = angular.element($window);
        scope.getWindowDimensions = function () {
            return {
                "h": $window["innerHeight"],
                "w": $window["innerWidth"]
            };
        };
        scope.$watch(scope.getWindowDimensions, function (newValue, oldValue) {
            scope.windowHeight = newValue.h;
            scope.windowWidth = newValue.w;
            scope.style = function () {
                return {
                  "height": (newValue.h)-75 + "px",
                  "width": ((newValue.w ) - $("#jstree-id-width").width()) + "px"
                };
            };
        }, true);
        w.bind("resize", function () {
            scope.$apply();
        });
    };
});

/**
 * Diretiva de resizing para mapa quando for usado em iframe
 * em aplicações externas.
 * 
 * Não leva em consideração menu superior nem TreeView lateral
 */
app.directive("resizeiframe", function ($window) {
    return function (scope, element) {
        var w = angular.element($window);
        scope.getWindowDimensions = function () {
            return {
                "h": $window["innerHeight"],
                "w": $window["innerWidth"]
            };
        };
        scope.$watch(scope.getWindowDimensions, function (newValue, oldValue) {
            scope.windowHeight = newValue.h;
            scope.windowWidth = newValue.w;
            scope.style = function () {
                return {
                  "height": (newValue.h) + "px",
                  "width": (newValue.w ) + "px"
                };
            };
        }, true);
        w.bind("resize", function () {
            scope.$apply();
        });
    };
});

  