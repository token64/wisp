app.controller("ProfilesController", function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout) {
	$rootScope.dialogService = dialogService;		

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
	  })(window,document,"script","https://www.google-analytics.com/analytics.js","ga");
	  ga("create", "UA-REPLACE-WITH-YOUR-ID", "auto");
	  ga("set", "page", "/meus_dados");
	  ga("send", "pageview");
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	
	$scope.find = function(link){
		$rootScope.form = [];
		$rootScope.form.error = [];
		$rootScope.form.email = "";
		$rootScope.form.language = "";
		$rootScope.form.level = "";
		$rootScope.form.map_type = "";
		$rootScope.form.name = "";

		$.get(link, function(data) {	
			user = [];
	
		 	user.full_name = data.full_name;
		 	user.first_name = data.first_name;
		 	user.last_name = data.last_name;
		 	user.level = data.level;
		 	switch(user.level){
		 		case 1:
		 			user.level_label="View";
		 			break;
		 		case 2:
		 			user.level_label="Técnico";
		 			break;
		 		case 3:
		 			user.level_label="Administrador";
		 			break;
		 		default:
		 			break;
		 	}
		 	user.email = data.email;
		 	user.date_created = Functions.date_format(data.date_created);
		 	user.map_type = data.user_setting.map_type;
		 	user.language = data.user_setting.language;
		 	user.auto_save = data.user_setting.auto_save;
		 	user.currency_symbol = data.user_setting.currency_symbol;
		 	user.show_tips = data.user_setting.show_tips;

		 	$rootScope.user = user;
		 	$rootScope.form = user;
		 	
			$rootScope.$apply();
		});
	};

	//função de botoes que nao enviam requisições
	$scope.edit_profile = function(){
		//abrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title:"Editar perfil",
			width: 600,
			resizable:false,	
			dialogClass: "noclose",		
		};
		model = [];	
		$rootScope.dialogService.open("edit_profile_modal","edit_profile_modal", model, options).then();		
	};

	$scope.edit_perfil_confirm = function(link){
		//botao de confimação do cadastro/alteração
		//limpando os erros
		$rootScope.form.error = [];
		erro = false;		
		
		if(($rootScope.form.old_password != "")|| ($rootScope.form.password_confirm != "") ||($rootScope.form.password != "")){
			if((typeof($rootScope.form.old_password) != "undefined")|| (typeof($rootScope.form.password_confirm) != "undefined") ||(typeof($rootScope.form.password) != "undefined")){

				if($rootScope.form.old_password == "" || typeof($rootScope.form.old_password) == "undefined"){
					$rootScope.form.error.old_password  = $rootScope.Users.translateText("Informe a senha atual");
					erro = true;
				}
				if($rootScope.form.password == "" || typeof($rootScope.form.password) == "undefined"){
					$rootScope.form.error.password  = $rootScope.Users.translateText("Informe a nova senha");
					erro = true;
				}else{
					if($rootScope.form.password_confirm != $rootScope.form.password){
						$rootScope.form.error.password_confirm  = $rootScope.Users.translateText("As senhas não coincidem");
						erro = true;
					}	
				}
			}
		}

				
		if($rootScope.form.first_name == ""|| typeof($rootScope.form.first_name) == "undefined"){
			$rootScope.form.error.first_name  = $rootScope.Users.translateText("Informe o nome");
			erro = true;
		}
		if( $rootScope.form.last_name == ""|| typeof($rootScope.form.last_name) == "undefined"){
			$rootScope.form.error.last_name  = $rootScope.Users.translateText("Informe o sobrenome");
			erro = true;	
		}
		if($rootScope.form.language == ""|| typeof($rootScope.form.language) == "undefined"){
			$rootScope.form.error.language  = $rootScope.Users.translateText("Selecione a linguagem");
			erro = true;
		}
		if($rootScope.form.map_type == ""|| typeof($rootScope.form.map_type) == "undefined"){
			$rootScope.form.error.map_type  = $rootScope.Users.translateText("Selecione o tipo de mapa");
			erro = true;
		}

		if(!erro){					
			if($rootScope.form.auto_save){
				auto_save = 1;
			}else{
				auto_save = 0;
			}
			
			$.post(link, 
				{
					first_name:$rootScope.form.first_name,
					last_name:$rootScope.form.last_name,
					password:$rootScope.form.password,
					old_password:$rootScope.form.old_password,
					password_confirm:$rootScope.form.password_confirm,
					user_setting:
					{
						language:$rootScope.form.language,
						map_type:$rootScope.form.map_type,
						auto_save:auto_save,
						currency_symbol:$rootScope.form.currency_symbol,
						show_tips:$rootScope.form.show_tips
					}
				},
				function(data) {
					if(data.status == 1){
						$rootScope.message = data.message;
						$rootScope.user = $rootScope.form;
						$rootScope.user.full_name = $rootScope.form.first_name+" "+$rootScope.form.last_name;
						$timeout(function() {
							$rootScope.message = "";
					      	$rootScope.dialogService.close("edit_profile_modal");	
						}, 3000);
					}else{
						angular.forEach(data.errors,function(val,index){
							$rootScope.form.error[index] = val;
						});
						$rootScope.message_error = data.message_error;						
					}					
					$rootScope.$apply();					
				}
			);
		}

	};

	/**
	 * Requests a new token for API Access
	 */
	$scope.generate_token = function(link){
		$.ajax({
			url: link,
			type: "POST",
			success:function(response){
				if (response.status){
					// If token was generated successfully, show on screen
					$scope.showToken(response.data.token);
				}
			}
		});
	};

	/**
	 * Show the new token on the screen
	 * 
	 * TODO Generate QR Code
	 */
	$scope.showToken = function(token){
		$rootScope.generated_token = token;
		//abrir modal de cadastro
		var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText("Token de Acesso"),
			width: 600,
			resizable:false,	
		};
		model = [];
		$rootScope.dialogService.open("showTokenModal","showTokenModal", model, options).then();

		setTimeout(function(){
			// Generate QR Code of token
			console.log(document.getElementById("qrcode"));
			var qrcode = new QRCode(document.getElementById("qrcode"), {
				width : 200,
				height : 200,
				useSVG: true
			});
			console.log(qrcode);
			qrcode.makeCode(token);
		}, 20);
		
	};
	

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
		this.find();
	};






});
