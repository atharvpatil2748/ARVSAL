/**
 * Cognitive Event Bus (Phase 5)
 *
 * Lightweight pub/sub bus for inter-agent communication and cognitive state transitions.
 * Agents subscribe to events (e.g. PROJECT_CREATED) rather than polling CSM.
 */

'use strict';

class CognitiveEventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event 
   * @param {function} callback 
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event 
   * @param {function} callback 
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  /**
   * Emit an event to all subscribers asynchronously
   * @param {string} event 
   * @param {object} payload 
   */
  emit(event, payload = {}) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    
    // Fire and forget
    setImmediate(() => {
      for (const cb of callbacks) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventBus] Error in listener for ${event}:`, err.message);
        }
      }
    });
  }
}

// Singleton export
module.exports = new CognitiveEventBus();

// Standard Event Constants
module.exports.EVENTS = {
  NODE_PROMOTED: 'MEMORY_PROMOTED',
  NODE_DEMOTED: 'MEMORY_DEMOTED',
  NODE_RESOLVED: 'NODE_RESOLVED',
  PROJECT_ACTIVATED: 'PROJECT_ACTIVATED',
  DECISION_MADE: 'DECISION_MADE',
  CONSTRAINT_ADDED: 'CONSTRAINT_ADDED'
};
