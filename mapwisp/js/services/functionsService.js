/* eslint-disable no-prototype-builtins */
app.service("Functions", function ($rootScope,$log,$http) {
      $rootScope.Validation = this;

      

      this.find_on = function(array,field,value) {
      	result = false;
		angular.forEach(array,function(val,index){
			if(val[field] == value){
				result = val;
			}			
		});
		return result;
	};


   	this.count_object = function(obj) {
		count = 0;
		for (var key in obj) {
	            if (obj.hasOwnProperty(key))
	                count++;
	      }
	      return count;
	};


	this.date_format = function(date) {
		if(!date){ return "00/00/0000";}
		count = date.length;


		if(count == 24){
			// 2015-06-11T11:49:00+0000
			date = date.split("T");
			return  this.date_format(date[0]);

		}

		if(count == 10){
			// 2015-06-11
			date = date.split("-");
			return(date[2]+"/"+date[1]+"/"+date[0]);
		}
	};

	this.current_date = function() {
    		var now = new Date();
		var day = ("0" + now.getDate()).slice(-2);
		var month = ("0" + (now.getMonth() + 1)).slice(-2);
		var today = now.getFullYear() + "-" + (month) + "-" + (day);

		return  this.date_format(today);
    	};

    	this.money_format = function(number,n, x, s, c){
    	 	// @param integer n: length of decimal
		// @param integer x: length of whole part
		// @param mixed   s: sections delimiter
		// @param mixed   c: decimal delimiter

	      var re = "\\d(?=(\\d{" + (x || 3) + "})+" + (n > 0 ? "\\D" : "$") + ")",
	      num = number.toFixed(Math.max(0, ~~n));
 
  	      data =  (c ? num.replace(".", c) : num).replace(new RegExp(re, "g"), "$&" + (s || ","));
  	     	return data;
	};

      
});
