/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
angular.module('esn.inbox-calendar')

  .component('calInboxInlinePartstatChooser', {
    controller: 'calInboxInlinePartstatChooserController',
    controllerAs: 'ctrl',
    bindings: {
      message: '<'
    },
    template: require('./inline-partstat-chooser.pug')
  });

require('./inline-partstat-chooser.controller');
