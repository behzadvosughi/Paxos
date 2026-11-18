import { compareBallots, maxBallot } from './ballot';
import type { ReasonInfo } from '../i18n/reason';
import type { AcceptorState, Ballot } from './types';

export type AcceptorReply =
  | {
      kind: 'promise';
      ballot: Ballot;
      acceptedBallot: Ballot | null;
      acceptedValue: string | null;
    }
  | { kind: 'accepted'; ballot: Ballot; value: string }
  | { kind: 'nack'; ballot: Ballot; reason: ReasonInfo };

export interface AcceptorResult {
  acceptor: AcceptorState;
  reply: AcceptorReply;
}

export type NackReply = Extract<AcceptorReply, { kind: 'nack' }>;

export function isNackReply(reply: AcceptorReply): reply is NackReply {
  return reply.kind === 'nack';
}

/**
 * Phase 1 (Prepare / Promise).
 *
 * An acceptor promises a ballot when it is >= the ballot it already promised
 * (`promisedProposalNumber`). A lower ballot is rejected with a NACK so the
 * proposer learns it must use a higher ballot.
 */
export function onPrepare(acceptor: AcceptorState, ballot: Ballot): AcceptorResult {
  if (acceptor.promisedBallot && compareBallots(ballot, acceptor.promisedBallot) < 0) {
    return {
      acceptor,
      reply: {
        kind: 'nack',
        ballot,
        reason: { code: 'alreadyPromised', ballot: acceptor.promisedBallot },
      },
    };
  }

  return {
    acceptor: { ...acceptor, promisedBallot: ballot },
    reply: {
      kind: 'promise',
      ballot,
      acceptedBallot: acceptor.acceptedBallot,
      acceptedValue: acceptor.acceptedValue,
    },
  };
}

/**
 * Phase 2 (Accept / Accepted).
 *
 * An acceptor accepts the value unless it has already promised a strictly
 * higher ballot. Accepting also raises the promise to the accepted ballot.
 */
export function onAccept(acceptor: AcceptorState, ballot: Ballot, value: string): AcceptorResult {
  if (acceptor.promisedBallot && compareBallots(ballot, acceptor.promisedBallot) < 0) {
    return {
      acceptor,
      reply: {
        kind: 'nack',
        ballot,
        reason: { code: 'promisedHigher', ballot: acceptor.promisedBallot },
      },
    };
  }

  return {
    acceptor: {
      ...acceptor,
      promisedBallot: maxBallot(acceptor.promisedBallot, ballot),
      acceptedBallot: ballot,
      acceptedValue: value,
    },
    reply: { kind: 'accepted', ballot, value },
  };
}
