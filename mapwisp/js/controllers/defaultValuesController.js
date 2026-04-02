app.controller('DefaultValuesController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout,Users,LevelsAndModes) {

	$scope.isLoading = false;
	$scope.form = [];
	$scope.values = [];
    $scope.factoryValues = {
        "loss_spl_2": 3.7,
        "loss_spl_4": 7.3,
        "loss_spl_8": 10.5,
        "loss_spl_16": 13.7,
        "loss_spl_32": 17.1,
        "loss_spl_64": 20.5,
        "loss_km_1": 0.2,
        "loss_km_2": 0.25,
        "loss_km_3": 0.35,
        "loss_km_4": 3.5,
        "auto_reserve": 7,
        "research_interval": 5
    };
	
	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/valores_default');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	
	$scope.initialize = function(base_url){
		$rootScope.base_url = base_url;
		$scope.list();
		$rootScope.LevelsAndModes = LevelsAndModes;
		Users.getCurrentUser(base_url + '/users/get_current_user');
	}
	
	$scope.list = function(link){
		$scope.isLoading = true;
		$.ajax({
			url: $scope.base_url + '/default_values/list_all',
			type: 'POST',
			success:function(data){
				$scope.values = data;
                $scope.checkMissingValues();
				$scope.setModels(data);
				$scope.isLoading = false;
			},
			complete:function(){
				$scope.isLoading = false;
				$scope.$apply();
			}
		});
	}

    $scope.checkMissingValues = function(){
        for (key in $scope.factoryValues){
            if (!$scope.keyExists(key)){
                $scope.addValue(key, $scope.factoryValues[key]);
            }
        }
    }

    $scope.addValue = function (key, value) {
        dataSend = { name: key, value: value };
        $.ajax({
            url: $rootScope.base_url + '/default_values/add',
            data: dataSend,
            type: 'POST',
            success: function (data) {
                $scope.values.push(data.data);
                $scope.form[data.data.name] = data.data.value;
                $scope.$apply();
                $scope.set_success_message();
            },
            complete: function () {
                $scope.$apply();
            }
        });
    }

	$scope.setModels = function(data){
		angular.forEach(data, function(default_v, index){
			if (default_v.name == 'loss_spl_2'){
				$scope.form.loss_spl_2 = default_v.value;
			} else if (default_v.name == 'loss_spl_4'){
				$scope.form.loss_spl_4 = default_v.value;
			} else if (default_v.name == 'loss_spl_8'){
				$scope.form.loss_spl_8 = default_v.value;
			} else if (default_v.name == 'loss_spl_16'){
				$scope.form.loss_spl_16 = default_v.value;
			} else if (default_v.name == 'loss_spl_32'){
				$scope.form.loss_spl_32 = default_v.value;
			} else if (default_v.name == 'loss_spl_64'){
				$scope.form.loss_spl_64 = default_v.value;
			} else if (default_v.name == 'loss_km_1'){
				$scope.form.loss_km_1 = default_v.value;
			} else if (default_v.name == 'loss_km_2'){
				$scope.form.loss_km_2 = default_v.value;
			} else if (default_v.name == 'loss_km_3'){
				$scope.form.loss_km_3 = default_v.value;
			} else if (default_v.name == 'loss_km_4'){
				$scope.form.loss_km_4 = default_v.value;
			} else if (default_v.name == 'auto_reserve'){
				$scope.form.auto_reserve = default_v.value;
			} else if (default_v.name == 'research_interval'){
				$scope.form.research_interval = default_v.value;
			}
		});
	}
	
	$scope.edit = function(link){
        // Check which values are different, to send edit request
		angular.forEach($scope.values, function(val, index){
			if (val.value != $scope.form[val.name]){
				dataSend = {id:val.id, value:$scope.form[val.name]};
				$.ajax({
					url: $rootScope.base_url + '/default_values/edit',
					data: dataSend,
					type: 'POST',
					success:function(data){
						angular.forEach($scope.values, function(value, ind_v){
							if (value.id == dataSend.id){
								$scope.values[ind_v].value = dataSend.value;
							}
						});
						$scope.set_success_message();
					},
					complete:function(){
						$scope.$apply();
					}
				});
			}
		});

        // Check for new values, to add them
        for (key in $scope.form){
            if (!$scope.keyExists(key)){
                $scope.addValue(key, $scope.form[key]);
            }
        }
	}

    $scope.keyExists = function(key){
        for (idx in $scope.values) {
            const val = $scope.values[idx];
            if (val.name === key){
                return true;
            }
        }
        return false;
    }
	
	$scope.set_success_message = function(){
		$scope.message_success = $rootScope.Users.translateText("Valores editados com sucesso!");
        $timeout(function(){           
        	$scope.message_success = '';          
        },1000);
	}
	
})