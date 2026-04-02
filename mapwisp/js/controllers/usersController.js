app.controller("UsersController", function (Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout) {

	$scope.form = [];
	$scope.form.error = [];
	$scope.form.email = "";
	$scope.form.language = "pt_BR";
	$scope.form.level = "";
	$scope.form.map_type = "roadmap";
	$scope.form.password = "";
	$scope.form.password_confirm = "";
	$scope.form.auto_save_view = "on";
	$scope.form.active = "on";
	$scope.pagina = 1;
	$scope.form.first_name = "";
	$scope.form.last_name = "";
	$rootScope.dialogService = dialogService;
    $scope.base_address = "";

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
	  })(window,document,"script","https://www.google-analytics.com/analytics.js","ga");
	  ga("create", "UA-REPLACE-WITH-YOUR-ID", "auto");
	  ga("set", "page", "/users");
	  ga("send", "pageview");
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------	

    /**
     * 
     * @param {*} date 
     */
    $scope.formatDate = function(date, withTime){
        function addLeadingZero(number){
            return number <= 9 ?  "0" + number : number;
        }
        if (withTime) {
            return (
                addLeadingZero(date.getDate().toString()) + "/" + 
                (addLeadingZero(date.getMonth()+1).toString()) + "/" + 
                date.getFullYear() + " - " + 
                addLeadingZero(date.getHours().toString()) + ":" +
                addLeadingZero(date.getMinutes().toString())
            );
        } else {
            return (
                addLeadingZero(date.getDate().toString()) + "/" + 
                (addLeadingZero(date.getMonth()+1).toString()) + "/" + 
                date.getFullYear()
            );
        }
    };

	$scope.list_all = function(base_request_url){
        var link = base_request_url + "/list_all";
	    $rootScope.users = [];
	 	users = [];
  		$http.post(link).
			success(function(data){		
				$.each(data,function(index, user) {

                    if (user.last_login !== null) {
                        user.last_login = $scope.formatDate(new Date(user.last_login), true);
                    } else {
                        user.last_login = $rootScope.Users.translateText("Nunca fez login");
                    }
                    

			      	if(user.active == 1){
                        user.active_label = $rootScope.Users.translateText("Ativo");
			      	}else{
                        user.active_label = $rootScope.Users.translateText("Inativo");
			      	}
			      	user.date_created = Functions.date_format(user.date_created);			      	
			      	$rootScope.users.push(user);
			      });						
			}
		);		
	};

	//função de botoes que nao enviam requisições
	$scope.addUser = function(){
		//abrrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText("Adicionar usuário"),
			width: 600,
			resizable:false,	
			dialogClass: "noclose",			
			close: function(){
				$scope.form = [];
				$scope.form.error = [];
				$scope.form.email = "";
				$scope.form.active_true = true;
				$scope.form.active_false = false;
				$scope.form.language = "pt_BR";
				$scope.form.level = 0;
				$scope.form.map_type = "roadmap";
				$scope.form.password = "";
				$scope.form.password_confirm = "";
				$scope.form.view_auto_save_on = true;
				$scope.form.view_auto_save_off = false;
				$scope.form.first_name = "";
				$scope.form.last_name = "";

				$rootScope.dialogService.close("addUser");
				
			}
		};
		model = [];
		$rootScope.dialogService.open("addUser","addUser", model, options).then();
	};

	$scope.addUser_confirm = function(link){
		//botao de confimação do cadastro/alteração
		//limpando os erros
		$scope.form.error = [];
		erro = false;
		
		if($scope.form.email == ""){			
			$scope.form.error.email  = $rootScope.Users.translateText("Informe o email");
			erro = true;
		}else{
			if(!Validation.validateEmail($scope.form.email)){
				$scope.form.error.email  = $rootScope.Users.translateText("O email precisa ser válido");
				erro = true;	
			}
		}
		if($scope.form.password == ""){
			$scope.form.error.password  = $rootScope.Users.translateText("Informe a senha");
			erro = true;
		}
		if($scope.form.first_name == ""){
			$scope.form.error.first_name  = $rootScope.Users.translateText("Informe o nome");
			erro = true;
		}
		if( $scope.form.last_name == ""){
			$scope.form.error.last_name  = $rootScope.Users.translateText("Informe o sobrenome");
			erro = true;	
		}
		if($scope.form.level == ""){
			$scope.form.error.level  = $rootScope.Users.translateText("Selecione o nível");
			erro = true;
		}
		if($scope.form.password_confirm != $scope.form.password){
			$scope.form.error.password_confirm  = $rootScope.Users.translateText("As senhas não coincidem");
			erro = true;
		}

		if(!erro){
			$.post(link, {email:$scope.form.email, password:$scope.form.password,password_repeat:$scope.form.password_confirm, level:$scope.form.level,first_name:$scope.form.first_name,last_name:$scope.form.last_name},
				function(data) {
					if(data.status == 1){
						user = [];
						user.first_name = $scope.form.first_name;
						user.last_name = $scope.form.last_name;
						user.email = $scope.form.email;
						user.level = $scope.form.level;
						user.active = 1;

						user.active_label = $rootScope.Users.translateText("Ativo");
						user.date_created = Functions.current_date();
						user.id = data.id;

						$rootScope.message_success = data.message;
						$rootScope.dialogService.close("addUser");
						$timeout(function() {
							$rootScope.message = "";					      		
							$rootScope.users.push(user);
						}, 3000);
					}else{
						angular.forEach(data.errors,function(val,index){
							$scope.form.error[index] = val;
						});
					}
					$scope.$apply();
				}
			);

		}

	};



	$scope.level_change = function(id,link){
		$.each($rootScope.users,function(index, el) {
			if(el.id == id){

				$.post(link, {id:$rootScope.users[index].id,level:$rootScope.users[index].level},
					function(data) {
                        var message_timeout = 0;
						if(data.status == 1){
							$rootScope.message_success = data.message;
                            message_timeout = 500;
						}else{
							$rootScope.message_error = data.message;
                            message_timeout = 3000;
						}
						$timeout(function() {
							$rootScope.message_success = false;
							$rootScope.message_error = false;
							
						}, message_timeout);
						$scope.$apply();
					}
				);
			}
		});
	};



	$scope.activate_user = function(id,link){
		$.each($rootScope.users,function(index, el) {
			if(el.id == id){

				if(!$rootScope.users[index].active){
					active = 1;
					active_label = $rootScope.Users.translateText("Ativo");
					link = link+"/activate";
				}else{
					active = 0;
					active_label = $rootScope.Users.translateText("Inativo");
					link = link+"/deactivate";
				}

				$.post(link, {id:$rootScope.users[index].id},
					function(data) {
                        var message_timeout = 0;
						if(data.status == 1){
							$rootScope.message_activate_success = data.message;
							$rootScope.users[index].active = active;
							$rootScope.users[index].active_label = active_label;
                            message_timeout = 500;
						}else{
							$rootScope.message_activate_error = data.message;
                            message_timeout = 3000;
						}
						$timeout(function() {
							$rootScope.message_activate_success = false;
							$rootScope.message_activate_error = false;
							$rootScope.dialogService.close("activate_modal");
						}, message_timeout);
						$scope.$apply();
					}
				);
			}
		});	
	};

	
	
	$scope.activate_user_modal = function(id){
		//abrrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText("Atenção"),
			width: 300,
			resizable:false,	
			dialogClass: "noclose",			
			close: function(){
				delete($rootScope.i_user);				
			}
		};
		model = [];
		//indice do usuario
		$rootScope.editing_user_id = id;
		$rootScope.dialogService.open("activate_modal","activate_modal", model, options).then();
	};


	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	};
	
	
	$scope.reset_password = function(id){
		//abrir modal para resetar senha de usuarios
	    var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText("Resetar senha"),
			width: 300,
			resizable:false,	
			dialogClass: "noclose",			
			close: function(){
				$scope.user_id = null;				
			}
		};
		model = [];
		//indice do usuario
		$rootScope.editing_user_id = id;
		$rootScope.dialogService.open("resetPasswordModal","resetPasswordModal", model, options).then();
	};
	
	$scope.reset_password_confirm = function(link_base){
		$rootScope.resetIsLoading = true;
		link = link_base+"/edit";
		dataSend = {};
		dataSend.id = $rootScope.editing_user_id;
		dataSend.password = $scope.form.reset_password;
		$.ajax({
			url: link,
			type: "POST",
			data: dataSend,
			success:function(data){
				$rootScope.resetIsLoading = false;
				if(data.status == 1){
					$scope.form.message_reset_success = data.message;
				} else {
					$scope.form.message_reset_error = data.message;
				}
				$scope.$apply();
				$timeout(function(){
					$scope.form.message_reset_error = null;
					$scope.form.message_reset_success = null;
					$scope.close("resetPasswordModal");
				},2000);
			},
			complete:function(){
				
			}
		});
	};

    /**
     * Shows confirmation modal, to confirm
     * @param {*} user_id 
     */
    $scope.remove = function(user_id){
        $rootScope.editing_user_id = user_id;

        //abrir modal para resetar senha de usuarios
	    var options = {
			autoOpen: false,
			modal: true,
			title: $rootScope.Users.translateText("Remover Usuário"),
			width: 300,
			resizable:false,	
			dialogClass: "noclose",
		};
		model = [];
		$rootScope.dialogService.open("removeUserModal","removeUserModal", model, options).then();
    };

    /**
     * Remove user
     * @param {*} user_id 
     */
    $scope.remove_confirm = function(base_request_url){
        var request_url = base_request_url + "/delete";
        $.ajax({
			url: request_url,
			type: "POST",
			data: {id: $rootScope.editing_user_id },
            success:function(data){
                var message_timeout = 0;
				if(data.status == 1){
					$scope.form.message_success = data.message;
					message_timeout = 500;
				} else {
					$scope.form.message_error = data.message;
					message_timeout = 3000;
				}
                $scope.list_all(base_request_url);
				$scope.$apply();
				$timeout(function(){
					$scope.form.message_success = null;
					$scope.form.message_error = null;
                    $scope.close("removeUserModal");
				}, message_timeout);
			}
        });
    };
});