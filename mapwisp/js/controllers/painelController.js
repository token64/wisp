app.controller("PainelController", function (
	    $rootScope,
		$scope, 
		Painel,
		DefaultValues,
        Translation
	) {

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
	  })(window,document,"script","https://www.google-analytics.com/analytics.js","ga");
	  ga("create", "UA-REPLACE-WITH-YOUR-ID", "auto");
	  ga("set", "page", "/dashboard");
	  ga("send", "pageview");
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	
	$scope.initialize = function(base_url){
        console.log("base url", base_url);
		$rootScope.base_url = base_url;
		//fazer buscas e setar sevices
		$rootScope.Painel = Painel;
        Painel.initTimeRanges();
        Painel.initPagination();
		//Painel.list_logs();
        Painel.get_company();
        Painel.getAccessPointsSummary();
        Painel.listCommercialUserLogs();
        Painel.listLogsNew();
		Painel.list_clients();
		Painel.list_clients_date();
		$rootScope.DefaultValues = DefaultValues;
		DefaultValues.list();
        $rootScope.Translation = Translation;
	};

	$scope.editShowOnlyDeployedsAps = function() {
        console.log("editShowOnlyDeployedsAps");
		if($rootScope.Painel.show_only_deployeds_aps === null){
			return;
		}else{
			var data = $rootScope.Painel.show_only_deployeds_aps.value ? 1 : 0;
		}
		var adding = false;			
		  
		if ($rootScope.Painel.show_only_deployeds_aps.id == null){
			//add
			dataSend = {name:"show_only_deployeds_aps",value:data};
			adding = true;
			var address = "/default_values/add";
		} else {
			//edit
			dataSend = {id:$rootScope.Painel.show_only_deployeds_aps.id,value:data};
			var address = "/default_values/edit";
		}
		
		$.ajax({
			url: $rootScope.base_url + address,
			data: dataSend,
			type: "POST",
			success:function(data_return){
				if (adding){
					self.show_only_deployeds_aps = {};
					self.show_only_deployeds_aps.id = data_return.id;
					self.show_only_deployeds_aps.value = data;
				} else {
					self.show_only_deployeds_aps.value = data;
				}
			},
			complete:function(){
				//$scope.$apply();
			}
		});
	};

    $scope.editBlockKmlExportForView = function() {
        console.log("editBlockKmlExportForView");
		if($rootScope.Painel.block_kml_export_for_view === null){
			return;
		}else{
			var data = $rootScope.Painel.block_kml_export_for_view.value ? 1 : 0;
		}
		var adding = false;			
		  
        console.log("data", $rootScope.Painel.block_kml_export_for_view);

		if ($rootScope.Painel.block_kml_export_for_view.id == null){
			//add
			dataSend = {name:"block_kml_export_for_view",value:data};
			adding = true;
			var address = "/default_values/add";
		} else {
			//edit
			dataSend = {id:$rootScope.Painel.block_kml_export_for_view.id,value:data};
			var address = "/default_values/edit";
		}
		
		$.ajax({
			url: $rootScope.base_url + address,
			data: dataSend,
			type: "POST",
			success:function(data_return){
				if (adding){
					$rootScope.Painel.block_kml_export_for_view = {};
					$rootScope.Painel.block_kml_export_for_view.id = data_return.id;
					$rootScope.Painel.block_kml_export_for_view.value = data;
				} else {
					$rootScope.Painel.block_kml_export_for_view.value = data;
				}
			},
			complete:function(){
				//$scope.$apply();
			}
		});
	};

});