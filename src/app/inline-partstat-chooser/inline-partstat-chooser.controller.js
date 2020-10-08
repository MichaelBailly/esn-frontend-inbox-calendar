angular.module('esn.inbox-calendar')
  .controller('calInboxInlinePartstatChooserController', calInboxInlinePartstatChooserController);

function calInboxInlinePartstatChooserController(
  $log,
  CAL_EVENT_METHOD,
  CAL_ICAL,
  INVITATION_MESSAGE_HEADERS,
  notificationFactory,
  calEventService,
  calEventUtils,
  calInboxEventFetcherService
) {
  const self = this;

  self.show = false;
  self.$onInit = $onInit;
  self.$onChanges = $onInit;

  function $onInit() {
    const meeting = {
      method: self.message.headers[INVITATION_MESSAGE_HEADERS.METHOD] || CAL_EVENT_METHOD.REQUEST,
      uid: self.message.headers[INVITATION_MESSAGE_HEADERS.UID],
      recurrenceId: self.message.headers[INVITATION_MESSAGE_HEADERS.RECURRENCE_ID],
      sequence: self.message.headers[INVITATION_MESSAGE_HEADERS.SEQUENCE] || '0'
    };

    if (self.meeting) {
      if (self.meeting.method === meeting.method && self.meeting.uid === meeting.uid &&
        self.meeting.recurrenceId === meeting.recurrenceId && self.meeting.sequence === meeting.sequence) {
        // if the new meeting and ole meeting are the same we end the refresh here
        return;
      }
    }
    self.meeting = meeting;
    self.show = false;
    self.event = null;
    self.attendee = null;

    if (self.meeting.method !== CAL_EVENT_METHOD.REQUEST) {
      return;
    }

    calInboxEventFetcherService(self.meeting)
      .then(event => {
        self.event = event;

        // we don't handle recurring events because right now implementation is buggy:
        // with this email, and even if we parse the ICS, we don't know what changed
        // in the recurrence: the master event, or a detached occurrence...
        // self.message.headers[INVITATION_MESSAGE_HEADERS.RECURRENCE_ID] never exists
        if (self.event.rrule) {
          return;
        }

        var attendee = calEventUtils.getUserAttendee(self.event);

        if (attendee) {
          self.attendee = attendee;
          if (self.attendee.partstat === CAL_ICAL.partstat.needsaction) {
            self.show = true;
          }
        }
      })
      .catch(err => {
        $log.error(`calInboxEventFetcherService error ${err}`);
      });
  }

  self.changeParticipation = function changeParticipation(partstat) {
    var attendee = self.attendee;

    if (!attendee || attendee.partstat === partstat) {
      return;
    }

    calEventService.changeParticipation(self.event.path, self.event, [attendee.email], partstat, self.event.etag)
      .then(onSuccess, onError);

    function onSuccess() {
      notificationFactory.weakSuccess('I have no use', 'Participation updated');
    }

    function onError(err) {
      self.onParticipationChangeFailure && self.onParticipationChangeFailure({ err: err });
    }
  };
}

require('../services/event-fetcher-service');
