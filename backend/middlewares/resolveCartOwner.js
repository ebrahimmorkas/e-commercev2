const crypto = require("crypto");
const mongoose = require("mongoose");
const { guestCartCookieOptions } = require("../utils/cookieOptions");
const User = require("../models/User");

// Runs AFTER optionalAuthenticate. Decides who this cart request belongs
// to and puts a single normalized descriptor on req.cartOwner:
//   { type: 'user',  id: <userId>  }
//   { type: 'guest', id: <guestCartId> }
//
// If the visitor is logged in, the user always wins (even if a stale guest
// cookie is still present - merge is handled separately at login time).
// If not logged in and no guest cookie exists yet, a new one is minted here
// so the very first cart interaction (even a plain "view cart") gets a
// stable identity that survives a multi-day absence.
const resolveCartOwner = async (req, res, next) => {
    try {
        if (req.user && req.user._id) {
            req.cartOwner = { type: "user", id: req.user._id };
            return next();
        }

        let guestCartId = req.cookies?.guestCartId;

        if (!guestCartId) {
            guestCartId = crypto.randomUUID();
            res.cookie("guestCartId", guestCartId, guestCartCookieOptions);
        }

        req.cartOwner = { type: "guest", id: guestCartId };

        // Best-effort "this browser previously logged in as this user" hint
        // for the abandoned-cart admin view (see Cart.possibleUserId). Never
        // blocks the request, never used for auth/merging - only ever
        // stamped as a display hint, and re-verified (still exists, still
        // active, still belongs to this vendor) here rather than trusted
        // blindly off the cookie alone.
        const knownUserId = req.signedCookies?.knownUserId;
        if (knownUserId && mongoose.Types.ObjectId.isValid(knownUserId)) {
            const knownUser = await User.findOne({ _id: knownUserId, vendorId: req.vendorId, status: "A" }).select("_id");
            if (knownUser) {
                req.possibleUserId = knownUser._id;
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = resolveCartOwner;