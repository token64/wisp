

app.controller('ColorCodesController', function (Users,LevelsAndModes,Functions,$rootScope,$scope,$http,dialogService, $window,$element,Upload,Validation,$timeout) {
	
	$rootScope.dialogService = dialogService;	

	//GOOGLE ANALYTICS------------------------------------------------------------------
	if ($rootScope.run_analytics){
	  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
	  ga('create', 'UA-REPLACE-WITH-YOUR-ID', 'auto');
	  ga('set', 'page', '/codigos_de_cores');
	  ga('send', 'pageview');
	}
	//GOOGLE ANALYTICS------------------------------------------------------------------
	$scope.initialize = function(link){
		$rootScope.LevelsAndModes = LevelsAndModes;
		Users.getCurrentUser(link+'/users/get_current_user');
	}

	$scope.list_all = function(link){ 
		$rootScope.base_url = link;
		$rootScope.color_codes = [];
		$rootScope.colors_options = [];
		$.ajax({
			url: link+'/list_all',
			type: 'POST',
			success:function(data){

				//decodifica cada codigo de cor json
				for(code of data){

					var codeColor = {};

					codeColor.id = code.id;
					codeColor.name = code.name;
					codeColor.connections_color_code = JSON.parse(code.connections_color_code_json);
					codeColor.fusions_color_code = JSON.parse(code.fusions_color_code_json);

					$rootScope.color_codes.push(codeColor);

					//opções de cores
					if(code.id === 1){
						$rootScope.colors_options = codeColor.fusions_color_code;
					}

				}

				$scope.$apply();
			}		
		});	
	}

	/*
	*	Make input colors for tubes and fibers
	*/
	$scope.draw_colors = function(type,num){
		if($rootScope.form['num_'+type] == 0){
			$rootScope.form['num_'+type] = 1;
		}
		if($rootScope.form['num_'+type] > 99){
			$rootScope.form['num_'+type] = 99;
		}
		if(num){
			$rootScope.form['num_'+type] = num;
			//deleta os que não serão usados
			$rootScope.form[type].splice(num,$rootScope.form[type].length)
		}

		i = 0;

		//preenche as cores se for edit, se não fica branco
		while(i < $rootScope.form['num_'+type]){			

			var codeColor = {};
			codeColor.number = i;

			if(type === "tubes"){
				codeColor.color = $scope.connections_color_code && $scope.connections_color_code[i] ? $scope.connections_color_code[i] : "#ffffff";
			}

			if(type === "fibers"){
				codeColor.color = $scope.fusions_color_code && $scope.fusions_color_code[i] ? $scope.fusions_color_code[i] : "#ffffff";
			}

			$rootScope.form[type][i] = $rootScope.form[type][i] ? $rootScope.form[type][i] : codeColor;
			
			i++;
		}
	}

	$scope.edit_color_code = function(code){

		title = $rootScope.Users.translateText('Editar código de cores');

		//abrir modal de cadastro
	      var options = {
			autoOpen: false,
			modal: true,
			title:title,
			width: 1100,
			resizable:false,

		};
		model = [];		
		//zerando o form
		$rootScope.form = [];
		$rootScope.form.error = [];

		$rootScope.form.num_tubes = 1;
		$rootScope.form.num_fibers = 1;
		
		$rootScope.form.tubes = [];
		$rootScope.form.fibers = [];

		$scope.fusions_color_code = [];
		$scope.connections_color_code = [];

		$rootScope.editing = false;

		//preenchendo informações para a tela
		if(code){
			$rootScope.editing = true;
			$rootScope.form.id = code.id;
			$rootScope.form.name = code.name;

			
			$scope.connections_color_code = code.connections_color_code;
			$scope.fusions_color_code = code.fusions_color_code;
			$rootScope.form.num_tubes = $scope.connections_color_code.length;
			$rootScope.form.num_fibers = $scope.fusions_color_code.length;

		}
		
		$scope.draw_colors('tubes');
		$scope.draw_colors('fibers');

		$rootScope.dialogService.open('add_color_code_modal','add_color_code_modal', model, options).then();
	}

	$scope.close = function(id){
		$rootScope.dialogService.close(id);
	}

	$scope.edit_color_code_confirm = function(){
		$rootScope.form.error = [];
		erro = false;
		if($rootScope.form.name == ''|| typeof($rootScope.form.name) == 'undefined'  ){
			$rootScope.form.error.name  = $rootScope.Users.translateText('Informe o nome');
			erro = true;
		}
		if( $rootScope.form.tubes.length < 1){
			$rootScope.form.error.color  = $rootScope.Users.translateText('Nenhum tubo definido');
			erro = true;	
		}
		if( $rootScope.form.fibers.length < 1){
			$rootScope.form.error.color  = $rootScope.Users.translateText('Nenhuma fibra definida');
			erro = true;	
		}
		
		if(!erro){
			if($rootScope.editing){
				link = $rootScope.base_url+'/edit';					
			}else{
				link = $rootScope.base_url+'/add';					
			}

			data = {};

			if($rootScope.editing){
				data.id = $rootScope.form.id;
			}
			data.name =  $rootScope.form.name;
			data.connections_color_code_json =  getCodeColor('tubes');
			data.fusions_color_code_json =  getCodeColor('fibers');
			//converte para rgb
			data.aps_color_code_json =  getCodeColor('fibers',true);

			$.ajax({
				url: link,
				type: 'POST',
				data: data,
				success:function(data){			
		            	if(data.status == 1){
		            		
							$rootScope.message = data.message;	
							
							$scope.list_all($rootScope.base_url)	;		

							$timeout(function() {
								$rootScope.message = '';
								$rootScope.dialogService.close('add_color_code_modal');							
							}, 3000);	
		            	}else{
		            		$rootScope.message_error_modal = data.message;					
							angular.forEach(data.errors,function(val,index){
								$scope.form.error[index] = val;
							});
							$timeout(function() {
								$rootScope.message = '';
								$rootScope.message_error_modal = '';							
							}, 3000);	
		            	}
				},
				complete:function(){
					$scope.$apply();
				}
			});

			function getCodeColor(type,needConvert){
				var colors = [];

				for(c of $rootScope.form[type]){

					var color = c.color;
					
					if(needConvert){
						color = hexToRgb(color);
					}

					colors.push(color);
					
				}

				return JSON.stringify(colors)
			}

			function hexToRgb(hex) {
				var r = parseInt(hex.substring(1, 3), 16);
				var g = parseInt(hex.substring(3, 5), 16);
				var b = parseInt(hex.substring(5, 7), 16);
				return [r,g,b];
			}
		}
	}
	
	$scope.delete = function(id){
		link = $rootScope.base_url+'/delete';
		$.ajax({
			url: link,
			type: 'POST',
			data: {id: id},
			success:function(data){
				if(data.status == 0){
					$rootScope.message_error = data.message;  
					$scope.$apply();
					$timeout(function() {
						$rootScope.message_error = '';
						$rootScope.dialogService.close('delete_modal');	
						$scope.$apply();
					}, 3000);
				}else{
					angular.forEach($rootScope.color_codes,function(val,index){
						if(val.id == id){
							$rootScope.color_codes.splice(index,1);
						}
					});
					$rootScope.message_success = data.message;
					$rootScope.dialogService.close('delete_modal');							
					$scope.$apply();
					$timeout(function() {
						$rootScope.message_success = '';
					}, 3000);		
				}
			}
		});
	}

	$scope.delete_color_code = function(id){
		//abrir modal de deleção
		var options = {
			autoOpen: false,
			modal: true,
			title:'Atenção',
			width: 250,
			resizable:false,	
		};
		model = [];		
		$rootScope.color_code_id = id;
		$rootScope.dialogService.open('delete_modal','delete_modal', model, options).then();	
		
	}

});