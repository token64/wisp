app.controller('FinancialController', function (Functions,$rootScope,$scope,$http,dialogService,Painel, $window,$element,Upload,Validation,$timeout,Map) {

	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/financial');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------	
	
	$rootScope.base_url = '/' + document.URL.split('/')[3];
	$rootScope.Painel = Painel;
	Painel.get_company();
	
});
