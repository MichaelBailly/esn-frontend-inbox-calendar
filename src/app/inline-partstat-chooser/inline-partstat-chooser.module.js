angular.module('esn.inbox-calendar')

  .component('calInboxInlinePartstatChooser', {
    controller: 'calInboxInlinePartstatChooserController',
    controllerAs: 'ctrl',
    bindings: {
      message: '<'
    },
    template: require('./inline-partstat-chooser.pug')
  })
  .controller('calInboxInlinePartstatChooserController', function (CAL_EVENT_METHOD, CAL_ICAL, INVITATION_MESSAGE_HEADERS, session, notificationFactory, calEventService, calEventUtils, calInboxEventFetcherService) {
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
        .then((event) => {
          self.event = event;

          self.canSuggestChanges = calEventUtils.canSuggestChanges(self.event, session.user);
          var attendee = calEventUtils.getUserAttendee(self.event);
          console.log('for event', event, attendee);
          if (attendee) {
            self.attendee = attendee;
            if (self.attendee.partstat === CAL_ICAL.partstat.needsaction) {
              console.log('event', event, 'set show to true');
              self.show = true;
            }
            return;
          }
        })
        .catch((err) => {
          console.log('calInboxEventFetcherService error', err);
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
    }

/*
      calendarService.getCalendar(self.event.calendarHomeId, self.event.calendarId).then(function (calendar) {
        return calendar.getOwner();
      }).then(function (owner) {
        attendee = calEventUtils.getUserAttendee(self.event, owner);
        self.currentPartstat = attendee.partstat;
      });
    }
*/
  })
  .factory('calInboxEventFetcherService', function ($q, CAL_EVENT_METHOD, calendarHomeService, calEventUtils, calEventService) {
    const eventFetcherBuffer = {};

    return fetchEvent;

    function fetchEvent(meeting, onComplete = () => {}) {
      let calendarHomeId;
      let event;
      return calendarHomeService.getUserCalendarHomeId()
        .then((homeID) => {
          calendarHomeId = homeID;
          return getEventByUIDThrottled(calendarHomeId, meeting.uid)
        })
        .then(selectEvent(meeting), handleNonExistentEvent)
        .then(assertEventInvolvesCurrentUser)
        .then(assertInvitationSequenceIsNotOutdated(meeting))
        .then(evt => {
          event = evt;
          return event;
        })
        .finally(onComplete);
    }

    function selectEvent(meeting) {
      return function selectEventPromise(event) {
        return (meeting.method === CAL_EVENT_METHOD.COUNTER ? selectMasterEventOrOccurence : selectMasterEventOrException)(meeting, event);
      }
    }

    function selectMasterEventOrOccurence(meeting, event) {
      var result = event;

      if (meeting.recurrenceId) {
        var date = calMoment(meeting.recurrenceId);

        result = event.expand(date.clone().subtract(1, 'day'), date.clone().add(1, 'day'))[0] || event;
      }

      return result;
    }

    function selectMasterEventOrException(meeting, event) {
      if (meeting.recurrenceId) {
        event = event.getExceptionByRecurrenceId(meeting.recurrenceId);

        if (!event) {
          return $q.reject(new InvalidMeetingError('Occurrence ' + meeting.recurrenceId + ' not found.'));
        }
      }

      return event;
    }

    function assertEventInvolvesCurrentUser(event) {
      if (calEventUtils.isOrganizer(event) || calEventUtils.getUserAttendee(event)) {
        return event;
      }

      return $q.reject(new InvalidMeetingError('Event does not involve current user.'));
    }

    function assertInvitationSequenceIsNotOutdated(meeting) {
      return function assertInvitationSequenceIsNotOutdatedInner(event) {
        if (+meeting.sequence < +event.sequence) {
          return $q.reject(new InvalidMeetingError('Sequence is outdated (event.sequence = ' + event.sequence + ').'));
        }

        return event;
      }
    }

    function handleNonExistentEvent(err) {
      return $q.reject(err.status === 404 ? new InvalidMeetingError('Event not found.') : err);
    }

    function getEventByUIDThrottled(calendarHomeId, meetingUid) {
      const k = `${calendarHomeId}/${meetingUid}`;
      if (eventFetcherBuffer[k]) {
        return eventFetcherBuffer[k];
      }

      const promise = $q((resolve, reject) => {
        setTimeout(() => {
          const davCall = calEventService.getEventByUID(calendarHomeId, meetingUid);
          davCall.then(resolve, reject);

          delete eventFetcherBuffer[k];
        }, 400);
      });

      eventFetcherBuffer[k] = promise;

      return promise;
    }
  });

class InvalidMeetingError extends Error {
  constructor(message, meeting) {
    super(message);
    this.message = message;
    this.meeting = meeting;
  }
}
