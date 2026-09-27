import { test } from "node:test";
import assert from "node:assert/strict";
import { createQueue, HOLD_JOURNEY_MS, HOLD_ORDER_MS, PRESENCE_MS } from "./queue.mjs";

const order = (label) => ({ type: "order", equipment: label, alias: "state", value: true });

test("runs one action at a time, in order of arrival", async () => {
  const forwarded = [];
  const q = createQueue({ forward: async (r) => (forwarded.push(r), true) });
  q.connect("a", 0);
  q.connect("b", 0);
  assert.equal(q.enqueue("a", "order", order("Lampe A"), 0, "req-a").position, 1);
  assert.equal(q.enqueue("b", "order", order("Lampe B"), 0, "req-b").position, 2);

  await q.tick(0);
  assert.deepEqual(forwarded, ["req-a"]);
  assert.equal(q.view("a", 0).running.mine, true);
  assert.equal(q.view("b", 0).waiting.length, 1);

  await q.tick(HOLD_ORDER_MS - 1);
  assert.deepEqual(forwarded, ["req-a"], "held for its time");
  await q.tick(HOLD_ORDER_MS);
  assert.deepEqual(forwarded, ["req-a", "req-b"]);
});

test("one pending action per visitor", () => {
  const q = createQueue({ forward: async () => true });
  q.connect("a", 0);
  assert.equal(q.enqueue("a", "journey", { journey: "salle-de-bain" }, 0).ok, true);
  const second = q.enqueue("a", "order", order("Lampe"), 0, "req");
  assert.equal(second.ok, false);
  assert.equal(second.reason, "pending");
});

test("refuses a journey it does not know", () => {
  const q = createQueue({ forward: async () => true });
  assert.equal(q.enqueue("a", "journey", { journey: "donjon" }, 0).reason, "unknown");
});

test("a journey holds the house for its visitor, who may act during it", async () => {
  const q = createQueue({ forward: async () => true });
  q.connect("a", 0);
  q.connect("b", 0);
  q.enqueue("a", "journey", { journey: "bureau" }, 0);
  q.enqueue("b", "order", order("Lampe"), 0, "req-b");
  await q.tick(0);
  assert.equal(q.holds("a"), true);
  assert.equal(q.holds("b"), false);
  await q.tick(HOLD_JOURNEY_MS - 1);
  assert.equal(q.view("b", HOLD_JOURNEY_MS - 1).running.kind, "journey");
  await q.tick(HOLD_JOURNEY_MS);
  assert.equal(q.holds("a"), false);
  assert.equal(q.view("b", HOLD_JOURNEY_MS).running.mine, true);
});

test("keeps every action in the journal, however fast, with who did it", async () => {
  const q = createQueue({ forward: async () => true });
  q.connect("a", 0);
  q.enqueue("a", "order", order("Lampe séjour"), 0, "req");
  await q.tick(0);
  await q.tick(HOLD_ORDER_MS);
  q.activity({ timestamp: 1, message: { template: "order.executed" } });
  const journal = q.view("a", HOLD_ORDER_MS).journal;
  assert.equal(journal.length, 2);
  const action = journal.find((l) => l.kind === "action");
  assert.equal(action.who, "Visiteur 1");
  assert.equal(action.mine, true);
  assert.equal(action.what.equipment, "Lampe séjour");
  assert.equal(q.view("other", HOLD_ORDER_MS).journal.find((l) => l.kind === "action").mine, false);
});

test("never sends a visitor's id to another", async () => {
  const q = createQueue({ forward: async () => true });
  q.connect("secret-a", 0);
  q.enqueue("secret-a", "order", order("Lampe"), 0, "req");
  await q.tick(0);
  assert.equal(JSON.stringify(q.view("b", 0)).includes("secret-a"), false);
});

test("drops the pending action of a visitor gone for good", async () => {
  const q = createQueue({ forward: async () => true });
  q.connect("a", 0);
  q.connect("b", 0);
  q.enqueue("a", "journey", { journey: "sejour" }, 0);
  q.enqueue("b", "journey", { journey: "bureau" }, 0);
  q.disconnect("b", 0);
  await q.tick(0);
  await q.tick(PRESENCE_MS + 1);
  assert.equal(q.view("a", PRESENCE_MS + 1).waiting.length, 0);
});

test("records a failed forward as failed, and moves on", async () => {
  const q = createQueue({ forward: async () => false });
  q.connect("a", 0);
  q.enqueue("a", "order", order("Lampe"), 0, "req");
  await q.tick(0);
  assert.equal(q.view("a", 0).journal[0].what.failed, true);
});
