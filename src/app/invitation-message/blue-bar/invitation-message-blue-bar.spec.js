'use strict';

/* global chai: false */

var expect = chai.expect;

describe('The calInboxInvitationMessageBlueBar component', function() {

  var $compile, $rootScope, scope, element;

  function initDirective() {
    element = $compile('<div dynamic-directive="inbox-message-info" />')(scope);
    scope.$digest();
  }

  beforeEach(function() {
    module('esn-frontend-inbox-calendar');
    module('jadeTemplates');

    module(function($provide) {
      $provide.value('linkyFilter', angular.noop);
    });
  });

  beforeEach(inject(function(_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;

    scope = $rootScope.$new();
  }));

  it('should register a dynamic directive to "inbox-message-info"', function() {
    scope.email = {
      headers: {
        'X-MEETING-UID': '1234'
      }
    };
    initDirective();

    expect(element.find('cal-inbox-invitation-message-blue-bar')).to.have.length(1);
  });

  it('should not be injected if there is no email in scope', function() {
    initDirective();

    expect(element.find('cal-inbox-invitation-message-blue-bar')).to.have.length(0);
  });

  it('should not be injected if email has no headers', function() {
    scope.item = {};
    initDirective();

    expect(element.find('cal-inbox-invitation-message-blue-bar')).to.have.length(0);
  });

  it('should not be injected if email has no X-MEETING-UID header', function() {
    scope.item = {
      headers: {}
    };
    initDirective();

    expect(element.find('cal-inbox-invitation-message-blue-bar')).to.have.length(0);
  });

});
