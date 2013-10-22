
ko.subscription = function (target, callback, disposeCallback) {
    this.target = target;
    this.callback = callback;
    this.disposeCallback = disposeCallback;
    ko.exportProperty(this, 'dispose', this.dispose);
};
ko.subscription.prototype.dispose = function () {
    this.isDisposed = true;
    this.disposeCallback();
};

ko.subscribable = function () {
    this._subscriptions = {};

    ko.utils.extend(this, ko.subscribable['fn']);
    ko.exportProperty(this, 'subscribe', this.subscribe);
    ko.exportProperty(this, 'extend', this.extend);
    ko.exportProperty(this, 'getSubscriptionsCount', this.getSubscriptionsCount);
}

var defaultEvent = "change";

ko.subscribable['fn'] = {
    subscribe: function (callback, callbackTarget, event) {
        event = event || defaultEvent;
        var boundCallback = callbackTarget ? callback.bind(callbackTarget) : callback;

        var subscription = new ko.subscription(this, boundCallback, function () {
            ko.utils.arrayRemoveItem(this._subscriptions[event], subscription);
        }.bind(this));

        if (!this._subscriptions[event])
            this._subscriptions[event] = [];
        this._subscriptions[event].push(subscription);
        return subscription;
    },

    "notifySubscribers": function (valueToNotify, event) {
        event = event || defaultEvent;
        if (this.hasSubscriptionsForEvent(event)) {
            try {
                ko.dependencyDetection.begin();
                for (var a = this._subscriptions[event].slice(0), i = 0, subscription; subscription = a[i]; ++i) {
                    // In case a subscription was disposed during the arrayForEach cycle, check
                    // for isDisposed on each subscription before invoking its callback
                    if (subscription && (subscription.isDisposed !== true))
                        subscription.callback(valueToNotify);
                }
            } finally {
                ko.dependencyDetection.end();
            }
        }
    },

    hasSubscriptionsForEvent: function(event) {
        return this._subscriptions[event] && this._subscriptions[event].length;
    },

    getSubscriptionsCount: function () {
        var total = 0;
        ko.utils.objectForEach(this._subscriptions, function(eventName, subscriptions) {
            total += subscriptions.length;
        });
        return total;
    },

    'throttle': function(timeout) {
        var self = this, savedValue, throttleTimeoutInstance;
        if (ko.isObservable(self)) {
            function notifyIfDifferent(newValue) {
                if (self.isDifferent(savedValue, newValue)) {
                    self["notifySubscribers"](newValue);
                }
            }
            self.notifyThrottled = function(previousValue) {
                if (!throttleTimeoutInstance) {
                    savedValue = previousValue;
                    throttleTimeoutInstance = setTimeout(function() {
                        throttleTimeoutInstance = undefined;
                        notifyIfDifferent(self());
                        savedValue = undefined;
                    }, timeout);
                }
            };
        } else {
            // Replace notifySubscribers with one that throttles change events
            // Note that calling "throttle" multiple times is additive because it always chains onto the notifySubscribers function
            var originalNotifySubscribers = self['notifySubscribers'];
            self['notifySubscribers'] = function(valueToNotify, event) {
                if (event === defaultEvent || event === undefined) {
                    savedValue = valueToNotify;
                    if (!throttleTimeoutInstance) {
                        throttleTimeoutInstance = setTimeout(function() {
                            throttleTimeoutInstance = undefined;
                            originalNotifySubscribers.call(self, savedValue, defaultEvent);
                            savedValue = undefined;
                        }, timeout);
                    }
                } else {
                    originalNotifySubscribers.call(self, valueToNotify, event);
                }
            };
        }
    },

    isDifferent: function(oldValue, newValue) {
        return !this['equalityComparer'] || !this['equalityComparer'](oldValue, newValue);
    },

    extend: applyExtenders
};


ko.isSubscribable = function (instance) {
    return instance != null && typeof instance.subscribe == "function" && typeof instance["notifySubscribers"] == "function";
};

ko.exportSymbol('subscribable', ko.subscribable);
ko.exportSymbol('isSubscribable', ko.isSubscribable);
