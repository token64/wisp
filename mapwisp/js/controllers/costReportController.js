app.controller('CostReportController', function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout, Groups, Projects) {

	$scope.isLoading = false;
	
	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/relatorio_custo');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	
	$scope.initialize = function(base_url){
		$rootScope.base_url = base_url;
		
		//Carregando services, e listando itens necessarios
        $rootScope.Projects = Projects;
        Projects.list(true);  

        $rootScope.Groups = Groups;
        Groups.list(); 
	}
	
	$scope.general = function(link){
		$scope.isLoading = true;
		$rootScope.base_url = link;
		$.ajax({
			url: 'cost_report',
			type: 'POST',
			success:function(data){
				$scope.general_cost_report = [];
				$scope.total_cost = data.total;
				console.log(data.total);
				console.log($scope.total_cost);
				$scope.$apply();
				$scope.isLoading = false;
			}		
		});	
	}
	
	
	$scope.complete = function(link){
		$("body").toggleClass("wait");
		$scope.isLoading = true;
		$.ajax({
			url: link + '/cost_report_graph',
			type: 'POST',
			success:function(data){
				console.log(data);
				init(data);
			}		
		});
		$scope.isLoading = false;
		$("body").toggleClass("wait");
	}
	
})