/////////BEFORE SAVES/////////
Parse.Cloud.beforeSave('Record', function(request, response) {
    var record = Parse.Object.extend('Record');
    var query = new Parse.Query(record);
  
    //Setting seconds to 0
    request.object.get('checkInDate').setSeconds(0); 
  
    //When Saving checkIn
    if (request.object.get('checkOutDate') == null) {
        //Check if record already exists without a Check-out
        query.equalTo("employee", request.object.get('employee'));
        query.doesNotExist("checkOutDate");
        query.count({
            success: function(count) {
                if (count > 0) {
                    response.error('Ya realizaste un Check-In y aún no hiciste Check-Out.');
                } else {
                    request.object.set("workedHours", 0);
                    response.success();
                }
            },
            error: function(error) {
                response.error('Error al intentar grabar el Check-In.');
            }
        });
    } //When Saving License 
    else if (request.object.get('checkOutDate') != null && request.object.get('forReason') != null) {
        //Set CheckOut Seconds to 0
        request.object.get('checkOutDate').setSeconds(0); 
  
        request.object.set("workedHours", 0);
        response.success();
    } //When Saving CheckOut 
    else {
        //Set CheckIn Seconds to 0
        request.object.get('checkOutDate').setSeconds(0); 
  
        //Get the difference between checkIn and CheckOut. Rounded to 2 decimals.
        var hours = Math.abs(request.object.get('checkOutDate') - request.object.get('checkInDate')) / 36e5;
        request.object.set("workedHours", hours.round(2));
        response.success();
    }
});
Number.prototype.round = function(places) {
    return +(Math.round(this + "e+" + places) + "e-" + places);
}
Parse.Cloud.beforeSave('Company', function(request, response) {
    //When Saving Companies verify all fields are complete.
    if (request.object.get('name') != null) {
        if (request.object.get('isActive') == null) {
            request.object.set("isActive", true);
        }
        response.success();
    } else {
        response.error('Faltan campos.');
    }
});
Parse.Cloud.beforeSave('Employee', function(request, response) {
    //When Saving Employees verify all fields are complete.
    var employee = Parse.Object.extend('Employee');
    var query = new Parse.Query(employee);
    if (request.object.get('employeeID') != null && request.object.get('name') != null && request.object.get('company') != null) {
        if (request.object.get('isActive') == null) {
            request.object.set("isActive", true);
        }
        response.success();
  
    } else {
        response.error('Faltan campos.');
    }
});
Parse.Cloud.beforeSave('Location', function(request, response) {
    //When Saving Locations verify all fields are complete.
    if (request.object.get('name') != null && request.object.get('locationCompany') != null) {
        if (request.object.get('isActive') == null) {
            request.object.set("isActive", true);
        }
        response.success();
    } else {
        response.error('Faltan campos.');
    }
});
Parse.Cloud.beforeSave('Reason', function(request, response) {
    //When Saving Reasons verify all fields are complete.
    if (request.object.get('name') != null && request.object.get('reasonCompany') != null) {
        if (request.object.get('isActive') == null) {
            request.object.set("isActive", true);
        }
        response.success();
    } else {
        response.error('Faltan campos.');
    }
});
Parse.Cloud.beforeSave(Parse.User, function(request, response) {
    //When Saving Users verify all fields are complete.
    if (request.object.get('username') != null && request.object.get('name') != null && request.object.get('email') != null) {
        if (request.object.get('isActive') == null) {
            request.object.set("isActive", true);
        }
        if (request.object.get('needsBeacon') == null) {
            request.object.set("needsBeacon", false);
        }
        if (request.object.get('beaconUUID') == null) {
            request.object.set("beaconUUID", "0");
        }
        response.success();
    } else {
        response.error('Faltan campos.');
    }
});