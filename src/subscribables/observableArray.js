var observableArrayChangeEvents = {'changes':true, 'deleted':true, 'added':true};
ko.observableArray = function (initialValues) {
    if (arguments.length == 0) {
        // Zero-parameter constructor initializes to empty array
        initialValues = [];
    }
    if ((initialValues !== null) && (initialValues !== undefined) && !('length' in initialValues))
        throw new Error("The argument passed when initializing an observable array must be an array, or null, or undefined.");

    var observable = ko.observable(initialValues),
        trackingChanges = false,
        savedArray = [],
        lastEditScript,
        baseValueHasMutated = observable.valueHasMutated,
        baseSubscribe = observable.subscribe;

    // Compare the old array to the current array, and then save the current array
    function doCompare() {
        var value = observable.peek();
        lastEditScript = ko.utils.compareArrays(savedArray, value);
        lastEditScript['changes'] = lastEditScript;
        savedArray = value.slice(0);
    }

    // Begin tracking changes by doing an initial comparison (to an empty array)
    function trackChanges() {
        if (!trackingChanges) {
            doCompare();
            trackingChanges = true;
        }
    }

    // Whenever the array changes, run the comparison and send out notifications
    observable.subscribe(function() {
        if (trackingChanges) {
            doCompare();
            for (var e in observableArrayChangeEvents) {
                if (observable._subscriptions[e] && lastEditScript[e].length)
                    observable.notifySubscribers(lastEditScript[e], e);
            }
        };
    });

    // Intercept subscriptions to the observableArray so we can start tracking changes
    // if the user subscribes to our events
    observable.subscribe = function(callback, callbackTarget, event) {
        if (event && event in observableArrayChangeEvents) {
            trackChanges();
        }
        return baseSubscribe.call(this, callback, callbackTarget, event);
    };

    // Provide a function that can be used to retrieve the edit script from the most recent change.
    // The first time this is called, it will return a script showing only additions.
    observable.getEditScript = function() {
        trackChanges();
        return lastEditScript;
    };

    ko.utils.extendInternal(observable, ko.observableArray['fn']);

    return ko.exportProperties(observable,
        "subscribe", observable.subscribe,
        "getEditScript", observable.getEditScript
    );
}

ko.observableArray['fn'] = {
    'remove': function (valueOrPredicate) {
        var underlyingArray = this.peek();
        var removedValues = [];
        var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
        for (var i = 0; i < underlyingArray.length; i++) {
            var value = underlyingArray[i];
            if (predicate(value)) {
                if (removedValues.length === 0) {
                    this.valueWillMutate();
                }
                removedValues.push(value);
                underlyingArray.splice(i, 1);
                i--;
            }
        }
        if (removedValues.length) {
            this.valueHasMutated();
        }
        return removedValues;
    },

    'removeAll': function (arrayOfValues) {
        // If you passed zero args, we remove everything
        if (arrayOfValues === undefined) {
            var underlyingArray = this.peek();
            var allValues = underlyingArray.slice(0);
            this.valueWillMutate();
            underlyingArray.splice(0, underlyingArray.length);
            this.valueHasMutated();
            return allValues;
        }
        // If you passed an arg, we interpret it as an array of entries to remove
        if (!arrayOfValues)
            return [];
        return this['remove'](function (value) {
            return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
        });
    },

    'destroy': function (valueOrPredicate) {
        var underlyingArray = this.peek();
        var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
        this.valueWillMutate();
        for (var i = underlyingArray.length - 1; i >= 0; i--) {
            var value = underlyingArray[i];
            if (predicate(value))
                underlyingArray[i]["_destroy"] = true;
        }
        this.valueHasMutated();
    },

    'destroyAll': function (arrayOfValues) {
        // If you passed zero args, we destroy everything
        if (arrayOfValues === undefined)
            return this['destroy'](function() { return true });

        // If you passed an arg, we interpret it as an array of entries to destroy
        if (!arrayOfValues)
            return [];
        return this['destroy'](function (value) {
            return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
        });
    },

    'indexOf': function (item) {
        var underlyingArray = this();
        return ko.utils.arrayIndexOf(underlyingArray, item);
    },

    'replace': function(oldItem, newItem) {
        var index = this['indexOf'](oldItem);
        if (index >= 0) {
            this.valueWillMutate();
            this.peek()[index] = newItem;
            this.valueHasMutated();
        }
    }
}

// Populate ko.observableArray.fn with read/write functions from native arrays
// Important: Do not add any additional functions here that may reasonably be used to *read* data from the array
// because we'll eval them without causing subscriptions, so ko.computed output could end up getting stale
ko.utils.arrayForEach(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function (methodName) {
    ko.observableArray['fn'][methodName] = function () {
        // Use "peek" to avoid creating a subscription in any computed that we're executing in the context of
        // (for consistency with mutating regular observables)
        var underlyingArray = this.peek();
        this.valueWillMutate();
        var methodCallResult = underlyingArray[methodName].apply(underlyingArray, arguments);
        this.valueHasMutated();
        return methodCallResult;
    };
});

// Populate ko.observableArray.fn with read-only functions from native arrays
ko.utils.arrayForEach(["slice"], function (methodName) {
    ko.observableArray['fn'][methodName] = function () {
        var underlyingArray = this();
        return underlyingArray[methodName].apply(underlyingArray, arguments);
    };
});

ko.exportSymbol('observableArray', ko.observableArray);
