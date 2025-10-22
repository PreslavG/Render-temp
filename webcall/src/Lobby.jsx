import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "./scripts/firebase";
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  getDoc,
} from "firebase/firestore";

import "./Lobby.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [isRoomPopupOpen, setIsRoomPopupOpen] = useState(false);
  const [isRoomListOpen, setIsRoomListOpen] = useState(false);
  const [isFriendsPopupOpen, setIsFriendsPopupOpen] = useState(false);
  const [isUserOptionsOpen, setIsUserOptionsPopupOpen] = useState(false);

  const [text, setText] = useState("");
  const [rooms, setRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [roomInvites, setRoomInvites] = useState([]);
  const [activeTab, setActiveTab] = useState("rooms");

  // ✅ added: track selected friend + selected room
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const user = auth.currentUser;

  // 🔹 Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // 🔹 Join room
  const joinRoom = (room) => {
    if (!user) return;
    const role = room.adminId === user.uid ? "admin" : "user";
    navigate(`/room/${room.id}`, { state: { role } });
  };

  // 🔹 Fetch user rooms (real-time)
  useEffect(() => {
    if (!user) return;
    const roomsRef = collection(db, "users", user.uid, "rooms");
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      setRooms(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  // 🔹 Fetch friends (real-time)
  useEffect(() => {
    if (!user) return;
    const friendsRef = collection(db, "users", user.uid, "friends");
    const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
      setFriends(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  // 🔹 Fetch incoming friend requests (real-time)
  useEffect(() => {
    if (!user) return;
    const requestsRef = collection(db, "users", user.uid, "friendRequests");
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      setFriendRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  // 🔹 Fetch room invites (real-time)
  useEffect(() => {
    if (!user) return;
    const invitesRef = collection(db, "users", user.uid, "roomInvites");
    const unsubscribe = onSnapshot(invitesRef, (snapshot) => {
      setRoomInvites(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  // 🔹 Add new room
  const roomAdd = async () => {
    if (!user || text.trim() === "") return;
    try {
      await addDoc(collection(db, "users", user.uid, "rooms"), {
        name: text,
        createdAt: new Date(),
        adminId: user.uid,
        adminEmail: user.email,
      });
      setText("");
      setIsRoomPopupOpen(false);
    } catch (e) {
      console.error("Error adding room:", e);
    }
  };

  // 🔹 Send friend request
  const sendFriendRequest = async () => {
    if (!user || text.trim() === "") return;

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", text));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No user found with that email.");
        return;
      }

      const targetUserDoc = querySnapshot.docs[0];
      const targetUserId = targetUserDoc.id;

      if (targetUserId === user.uid) {
        alert("You cannot send a request to yourself.");
        return;
      }

      const existingReq = query(
        collection(db, "users", targetUserId, "friendRequests"),
        where("fromId", "==", user.uid)
      );
      const existingSnapshot = await getDocs(existingReq);
      if (!existingSnapshot.empty) {
        alert("Friend request already sent.");
        return;
      }

      await addDoc(collection(db, "users", targetUserId, "friendRequests"), {
        fromId: user.uid,
        fromEmail: user.email,
        fromName: user.displayName || "Anonymous",
        status: "pending",
        createdAt: new Date(),
      });

      alert("Friend request sent!");
      setText("");
      setIsFriendsPopupOpen(false);
    } catch (e) {
      console.error("Error sending friend request:", e);
    }
  };

  // 🔹 Accept friend request
  const acceptRequest = async (req) => {
    try {
      await Promise.all([
        addDoc(collection(db, "users", user.uid, "friends"), {
          friendId: req.fromId,
          name: req.fromName,
          friendEmail: req.fromEmail,
        }),
        addDoc(collection(db, "users", req.fromId, "friends"), {
          friendId: user.uid,
          name: user.displayName || "Anonymous",
          friendEmail: user.email,
        }),
      ]);
      await deleteDoc(doc(db, "users", user.uid, "friendRequests", req.id));
    } catch (e) {
      console.error("Error accepting request:", e);
    }
  };

  const rejectRequest = async (req) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "friendRequests", req.id));
    } catch (e) {
      console.error("Error rejecting request:", e);
    }
  };

  // 🔹 Send room invite
  const sendRoomInvite = async () => {
    if (!selectedFriend || !selectedRoomId) return;

    try {
      const roomRef = doc(db, "users", user.uid, "rooms", selectedRoomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        alert("Room not found!");
        return;
      }

      const roomData = roomSnap.data();

      // find target user by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", selectedFriend.friendEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("User not found.");
        return;
      }

      const targetUserDoc = querySnapshot.docs[0];
      const targetUserId = targetUserDoc.id;

      // create invite in friend's Firestore path
      await addDoc(collection(db, "users", targetUserId, "roomInvites"), {
        fromId: user.uid,
        fromEmail: user.email,
        roomId: selectedRoomId,
        roomName: roomData.name,
        status: "pending",
        createdAt: new Date(),
      });

      alert(`Invite sent to ${selectedFriend.friendEmail} for room ${roomData.name}`);
      setIsRoomListOpen(false);
      setSelectedRoomId("");
      setSelectedFriend(null);
    } catch (error) {
      console.error("Error sending invite:", error);
    }
  };

  // 🔹 Accept / Reject Room Invite
  const acceptRoomInvite = async (invite) => {
    try {
      await addDoc(collection(db, "users", user.uid, "rooms"), {
        name: invite.roomName,
        roomId: invite.roomId,
        invitedBy: invite.fromEmail,
        createdAt: new Date(),
      });
      await deleteDoc(doc(db, "users", user.uid, "roomInvites", invite.id));
    } catch (e) {
      console.error("Error accepting room invite:", e);
    }
  };

  const rejectRoomInvite = async (invite) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "roomInvites", invite.id));
    } catch (e) {
      console.error("Error rejecting room invite:", e);
    }
  };

  // =======================================================
  // 🖥️ RENDER
  // =======================================================
  return (
    <div className="returnLobby">
      {/* Popup: Add Room */}
      {isRoomPopupOpen && (
        <div className="popup-overlay">
          <div className="popup">
            <h3>Enter room name:</h3>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type here..."
              maxLength={15}
            />
            <div>
              <button onClick={roomAdd}>Submit</button>
              <button onClick={() => setIsRoomPopupOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup: Send Friend Request */}
      {isFriendsPopupOpen && (
        <div className="popup-overlay">
          <div className="popup">
            <h3>Your ID: {user.uid}</h3>
            <h3>Send Friend Request</h3>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter friend's email..."
            />
            <div>
              <button onClick={sendFriendRequest}>Send</button>
              <button onClick={() => setIsFriendsPopupOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup: Select Room for Friend */}
      {isRoomListOpen && selectedFriend && (
        <div className="popup-overlay">
          <div className="popup">
            <h3>Invite {selectedFriend.friendEmail} to a Room</h3>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              <option value="">Select Room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div>
              <button onClick={sendRoomInvite}>Send Invite</button>
              <button onClick={() => setIsRoomListOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabButtons">
        <button
          className={activeTab === "rooms" ? "activeTab" : ""}
          onClick={() => setActiveTab("rooms")}
        >
          Rooms
        </button>
        <button
          className={activeTab === "friends" ? "activeTab" : ""}
          onClick={() => setActiveTab("friends")}
        >
          Friends
        </button>
        <button className="AddFriends" onClick={() => setIsFriendsPopupOpen(true)}>
          +
        </button>
      </div>

      {/* Rooms Tab */}
      {activeTab === "rooms" && (
        <div className="buttonList">
          <div className="TitlesAndRooms">
            <h1 className="buttonlistTitle">Available Rooms:</h1>
            <div className="RoomsButtons">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  className="roomButton"
                  onClick={() => joinRoom(room)}
                >
                  {room.name} {room.adminId === user.uid && <span>👑</span>}
                  <h1 className="roomPplcount">5👤</h1>
                </button>
              ))}
            </div>
          </div>
          <div className="buttons">
            <button onClick={() => setIsRoomPopupOpen(true)} className="lobbyButton">
              Add Room
            </button>
            <button onClick={handleLogout} className="lobbyButton">
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Friends Tab */}
      {activeTab === "friends" && (
        <div className="buttonList">
          <div className="Friends">
            <h1 className="buttonlistTitle">Friends:</h1>
            <div className="UserFriends">
              {friends.length === 0 && <p>No friends yet.</p>}
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  className="friendList"
                  onClick={() => {
                    setSelectedFriend(friend);
                    setIsRoomListOpen(true);
                  }}
                >
                  {friend.name || friend.friendEmail}
                </button>
              ))}
            </div>

            <h1 className="buttonlistTitle">Friend Requests:</h1>
            <div className="FriendRequests">
              {friendRequests.length === 0 && <p>No pending requests.</p>}
              {friendRequests.map((req) => (
                <div key={req.id} className="friendRequestItem">
                  <span>
                    {req.fromName} ({req.fromEmail})
                  </span>
                  <div>
                    <button onClick={() => acceptRequest(req)}>Accept</button>
                    <button onClick={() => rejectRequest(req)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>

            <h1 className="buttonlistTitle">Room Invites:</h1>
            <div className="RoomInvites">
              {roomInvites.length === 0 && <p>No pending room invites.</p>}
              {roomInvites.map((invite) => (
                <div key={invite.id} className="roomInviteItem">
                  <span>
                    {invite.fromEmail} invited you to <b>{invite.roomName}</b>
                  </span>
                  <div>
                    <button onClick={() => acceptRoomInvite(invite)}>Accept</button>
                    <button onClick={() => rejectRoomInvite(invite)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
