class InvalidMeetingError extends Error {
  constructor(message, meeting) {
    super(message);
    this.message = message;
    this.meeting = meeting;
  }
}

angular.module('esn.inbox-calendar')
  .factory('calInboxEventFetcherService', function($q, CAL_EVENT_METHOD, calendarHomeService, calEventUtils, calEventService, calMoment) {
    const eventFetcherBuffer = {};

    return fetchEvent;

    function fetchEvent(meeting, onComplete = () => { }) {
      let calendarHomeId;
      let event;

      return calendarHomeService.getUserCalendarHomeId()
        .then(homeID => {
          calendarHomeId = homeID;

          return getEventByUIDThrottled(calendarHomeId, meeting.uid);
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
      };
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
      };
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

