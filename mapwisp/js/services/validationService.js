app.service('Validation', function (dialogService,$rootScope,$log,$http) {
      var thisService = this;
      $rootScope.Validation = this;


   	this.validateEmail = function(email) {
		var rx = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
   		return rx.test(email);
	}

	this.validateIp = function(ip,tipo){
		// var ipv4 = "212.212.100.110";
		// var ipv6 = "0000:0000:0000:0000:0000:0000:0000:0001";

		//test ipv4
		if(tipo == 'ipv4'){
			if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)) {
			     return true;
			} else {
			     return false;
			}	
		}



		//test ipv6  
		if(tipo == 'ipv6'){
			if ( /^((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4}))*::((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4}))*|((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4})){7}$/g.test(ip)) {
				return true;
			} else {
			      return false;
			}	
		}
	}

	this.validateMacAddress = function(ip,tipo){
	
		if (/^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/g.test(ip)) {
			return true;
		} else {
		      return false;
		}	
	}
      

      
});