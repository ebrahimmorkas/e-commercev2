const crypto = require("crypto");
const { guestCartCookieOptions } = require("../utils/cookieOptions");

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
const resolveCartOwner = (req, res, next) => {
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
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = resolveCartOwner;