app = angular.module("mapwisp", [
    "ngSanitize",
    "dialogService",
    "angularUtils.directives.dirPagination",
    "ngFileUpload",
    "ui.utils.masks",
    "angularSpinner",
    "environment"
    ], function($httpProvider,$compileProvider){

    // USADO PARA PODER FAZER AS REQUISIÇÕES POST   SEM PROBLEMA... ANTES NAO MANDAVA OS DADOS "POST"

    // Use x-www-form-urlencoded Content-Type
    // $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    //*** The workhorse; converts an object to x-www-form-urlencoded serialization.* @param {Object} obj* @return {String}*/ 
    var param = function(obj) {
      var query = "", name, value, fullSubName, subName, subValue, innerObj, i;

      for(name in obj) {
          value = obj[name];
          if(value instanceof Array) {
            for(i=0; i<value.length; ++i) {
              subValue = value[i];
              fullSubName = name + "[" + i + "]";
              innerObj = {};
              innerObj[fullSubName] = subValue;
              query += param(innerObj) + "&";
            }
        }else if(value instanceof Object) {
          for(subName in value) {
              subValue = value[subName];
              fullSubName = name + "[" + subName + "]";
              innerObj = {};
              innerObj[fullSubName] = subValue;
              query += param(innerObj) + "&";
            }
        }else if(value !== undefined && value !== null)
          query += encodeURIComponent(name) + "=" + encodeURIComponent(value) + "&";
        }

      return query.length ? query.substr(0, query.length - 1) : query;
    };

    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [function(data) {
      return angular.isObject(data) && String(data) !== "[object File]" ? param(data) : data;
    }];
});

//Shifting variables depending on environment
app.config(function(envServiceProvider) {        
	// set the domains and variables for each environment 
    envServiceProvider.config({
        domains: {
            dev_remote_db: ["127.0.0.1"],
        	dev: ["localhost", "mapwisp.local"],
            lab: ["lab.tomodat.com.br"],
        	bruno_dev: ["bruno.dev.local"],
            production: [
                "sys.tomodat.com.br", 
                "mia.tomodat.com", 
                "sp.tomodat.com", 
                "sp.tomodat.com.br",
                "sp2.tomodat.com.br", 
                "ar.tomodat.com.br", 
                "ar.tomodat.com", 
                "cwb2.tomodat.com.br", 
                "cwb3.tomodat.com.br",
                "eu.tomodat.com",
                "mia3.tomodat.com",
                "mia2.tomodat.com",
                "ve.tomodat.com",
                "co.tomodat.com",
                "use.tomodat.com",
                "mx.tomodat.com",
                "cl.tomodat.com",
                "ar.tomodat.com",
                "nidix.tomodat.com",
                /* "mia4.tomodat.com", */ // Añade aquí tu dominio de producción
                "mx2.tomodat.com",
                "co2.tomodat.com",
                "cl2.tomodat.com",
            ]
        },
        vars: {
            dev_remote_db: {
                activate_analytics: false
            },
        	dev: {
                activate_analytics: false
            },
            lab: {
                activate_analytics: false
            },
            bruno_dev: {
            	activate_analytics: false
            },
            production: {
                activate_analytics: true
            }
        }
    });
    // run the environment check, so the comprobation is made 
    // before controllers and services are built 
    envServiceProvider.check();
});
//Setting the variables
app.run(function($rootScope, envService) {
	$rootScope.run_analytics = envService.read("activate_analytics");
})

//Usado para baixar arquivos
app.config(["$compileProvider",
            function ($compileProvider) {
                $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|blob):/);
        }]);


//LOGOUT POR INATIVIDADE -----------------------------------------------------------------
app.run(function($rootScope, $timeout, $document, $interval) {
    // Timeout timer value
    var TimeOutTimerValue = 3600000;
    // Start a timeout
    $rootScope.Logout_TimeOut_Thread = $timeout(function(){ LogoutByTimer(); } , TimeOutTimerValue);
    var bodyElement = angular.element($document);	
	angular.forEach(["keydown", "keyup", "click", "mousemove", "DOMMouseScroll", "mousewheel", "mousedown", "touchstart", "touchmove", "scroll", "focus"], 
		function(EventName) {
		 	bodyElement.bind(EventName, function (e) { TimeOut_Resetter(e); });  
	});
    function LogoutByTimer(){
        current_addr = window.location.href.split("/");
        if ((current_addr[current_addr.length-1] != "prelogin") && (current_addr[current_addr.length-1] != "login")){
	       	//Play audio alert
        	var audio = new Audio($rootScope.base_url+"/audio/alert_mapwisp.mp3");
	       	audio.play();
	       	
	        //Give a warning:
			//$rootScope.messageAlert = '<h6>Fazendo logout por inatividade em {{segundos_logout_inatividade}} segundos</h6>';
			var options = {
	                autoOpen: false,
	                modal: true,
	                title:"Atenção",
	                width: 550,
	                height:"auto",
	                resizable:true,
	                dialogClass: "noclose", 
	        };
	        model = [];  
	        $rootScope.dialogService.open("logoutInatividade","logoutInatividade", model, options).then();
	        $rootScope.logout_acionado = true;
	        $rootScope.timeoutLogout = $timeout(function() {
	        	$interval.cancel($rootScope.IntervalCountDown);
	            $timeout.cancel($rootScope.Logout_TimeOut_Thread);
	            $rootScope.logout_acionado = false;
	            $rootScope.dialogService.close("logoutInatividade");
	        	window.location.href = $rootScope.base_url+"/users/logout";
	        }, 30000);
	        CountDown();
        }
    }
    
    function TimeOut_Resetter(e){
        // Stop the pending timeout
    	if ($rootScope.logout_acionado){
    		$rootScope.dialogService.close("logoutInatividade");
    		$rootScope.logout_acionado = false;
    	}
    	$interval.cancel($rootScope.IntervalCountDown);
        $timeout.cancel($rootScope.timeoutLogout);
        // Stop the pending timeout
        $timeout.cancel($rootScope.Logout_TimeOut_Thread);

        // If logout timeout was explicitly turned off,
        // don't reset it after every event.
        if ($rootScope.no_logout_timeout){
            return;
        }

        // Reset the timeout
        $rootScope.Logout_TimeOut_Thread = $timeout(function(){ LogoutByTimer(); } , TimeOutTimerValue);
    }
    
    function CountDown(){
        var time_start = new Date();
        //Primeiro
        var time_now = new Date();
    	var seconds = (time_now.getTime() - time_start.getTime()) / 1000;
    	$rootScope.segundos_logout_inatividade = Math.ceil(30 - seconds);
    	//Continua contagem
        $rootScope.IntervalCountDown = $interval(function(){
        	var time_now = new Date();
        	var seconds = (time_now.getTime() - time_start.getTime()) / 1000;
        	$rootScope.segundos_logout_inatividade = Math.ceil(30 - seconds);
        }, 1000);
    }
});
//------------------------------------------------------------------------------------------

// Intervalo para avisar para API que usuario ainda esta online ----------------------------
// A cada 5 minutos (300k millissegundos) manda uma requisicao para /users/still_online ----
app.run(function($rootScope, $timeout, $document, $interval) {	
	// Set interval
	$rootScope.IntervalStillOnline = $interval(function(){
		$.ajax({
			url:  $rootScope.base_url+"/users/still_online",
			type: "POST",
			success:function(data){}
		});
	}, 300000);


    // Custom console.log
    // This gives us an array with all console log messages
    console.stdlog = console.log.bind(console);
    console.logs = [];
    console.log = function () {
        console.logs.push(Array.from(arguments));
        console.stdlog.apply(console, arguments);
    };
    console.stdwarn = console.warn.bind(console);
    console.warns = [];
    console.warn = function () {
        console.warns.push(Array.from(arguments));
        console.stdwarn.apply(console, arguments);
    };
    console.stderror = console.error.bind(console);
    console.errors = [];
    console.error = function () {
        console.errors.push(Array.from(arguments));
        console.stderror.apply(console, arguments);
    };
});
//------------------------------------------------------------------------------------------

function UrlExists(url){
    var http = new XMLHttpRequest();
    http.open("HEAD", url, false);
    http.send();
    return http.status!=404;
}