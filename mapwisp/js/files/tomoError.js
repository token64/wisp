/**
 * TOMO ERROR
 * 
 * Little bit of code to catch uncaught errors and send them to the
 * back end to be logged
 * 
 */

/**
 * Bind action to onerror event
 * 
 * Collect error data, print it on the console, and send it to be logged
 * in the backend
 */
window.onerror = function(error, url, line) {
    errorData = {};
    errorData.error = error;
    errorData.file = url;
    errorData.line = line;
    printError(errorData);
    sendError(errorData);
    return true;
};

/**
 * send error method
 * 
 * Creates request to send data to the backend
 */
sendError = function(errorData){
    var getUrl = window.location;
    var baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
    loggingEndpoint = baseUrl + "/users/log_js_error";
    $.ajax({
        url: loggingEndpoint,
        type: "POST",
        data: errorData,
        success:function(response){}
    });
};

/**
 * Prints error on the console
 */
printError = function(errorData){
    var green = "color: green; font-size: 20px";
    console.log("%cMAPWISP\n%cError detected. Error will be logged to backend\nError details:", green, "", errorData);
    console.log("");
};