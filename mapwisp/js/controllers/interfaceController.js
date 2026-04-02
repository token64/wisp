app.controller("InterfaceController", function (Users,LevelsAndModes,$rootScope,$scope,$http,dialogService, $window,$element,Upload) {

	$scope.initialize = function(link){
		$rootScope.LevelsAndModes = LevelsAndModes;
		Users.getCurrentUser(link+"/users/get_current_user");
	};

	$scope.openWhatsApp = function(){
		window.open("https://wa.me/REPLACE_E164_SIN_SIGNOS", "_blank");
	};

});