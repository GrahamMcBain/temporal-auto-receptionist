# From voice-agent prototype to durable appointment workflow

## 1. Opening — 1 minute

“I originally built Graham Auto Receptionist as a LiveKit voice-agent prototype. It demonstrated a real customer conversation: the agent could understand speech, check availability, and book an appointment. The question I asked next was: what would it take to let a real business trust the work happening after the conversation?”

## 2. Before — 2 minutes

Show `src/before/scheduling-service.ts`.

- The scheduling service is synchronous and process-local.
- It works for a happy-path demo, but a restart loses state.
- A caller can take time to confirm while the process has no durable record of the pending booking.
- Calendar, CRM, and notification calls have no durable retry or recovery story.

“The voice agent was not the problem. The missing piece was a reliable appointment lifecycle.”

## 3. The design boundary — 2 minutes

Show the diagram in the README.

- LiveKit remains responsible for real-time media and conversation.
- The agent starts a Temporal Workflow once it has validated appointment details.
- Temporal owns the durable business process, rather than trying to orchestrate audio streaming.

“Temporal is not the database or CRM. It is the durable coordinator for the work that touches them.”

## 4. Workflow and Activities — 4 minutes

Show `src/workflows/appointment.ts`, then `src/activities/appointment.ts`.

- `appointmentWorkflow` places a temporary hold through an Activity.
- It waits up to 15 minutes for `confirmAppointment` or `cancelAppointment` Signals.
- It releases the hold on cancellation or timeout.
- On confirmation, it calls idempotent Activities to create the appointment, update the CRM, and notify the customer.
- It starts a child Workflow for the durable reminder timer.

Explain the separation:

- Workflows are deterministic orchestration code and may safely wait for a long time.
- Activities perform side effects against systems outside Temporal and have retry policies.
- The Workflow ID is an idempotency key for the booking Activity.

## 5. Demo — 3 minutes

Run a local Temporal development server, then:

```bash
npm run dev:worker
npm run demo
```

Narrate the result:

1. The client starts one appointment Workflow.
2. The Workflow holds the requested slot and waits.
3. The client simulates the LiveKit agent sending the confirmation Signal.
4. The Workflow books, updates the CRM, notifies the customer, and starts the reminder Workflow.

Then point to `test/appointment-workflow.test.ts`:

- Confirmed workflow test.
- Cancelled workflow test.
- Temporal's time-skipping test environment makes durable waiting practical to test.

## 6. Trade-offs and next steps — 2 minutes

- Replace Activity fakes with a transactional calendar database and a CRM provider.
- Add a database uniqueness constraint or transactional reservation check for slot contention.
- Authenticate the staff-takeover path in the LiveKit app.
- Add workflow search attributes, metrics, tracing, and data-retention policies.
- Model rescheduling as a Signal or a dedicated follow-on Workflow.

Close with:

“AI lets developers prototype user experiences at remarkable speed. Temporal lets us carry those prototypes over the finish line by making the business process durable, observable, and resilient.”
