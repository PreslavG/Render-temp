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
} from "firebase/firestore";

import "./Lobby.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [isRoomPopupOpen, setIsRoomPopupOpen] = useState(false);
  const [isFriendsPopupOpen, setIsFriendsPopupOpen] = useState(false);
  const [text, setText] = useState("");
  const [rooms, setRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("rooms");

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
    return () => unsubscribe();
  }, [user]);

  // 🔹 Fetch friends (real-time)
  useEffect(() => {
    if (!user) return;
    const friendsRef = collection(db, "users", user.uid, "friends");
    const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
      setFriends(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // 🔹 Fetch incoming friend requests (real-time)
  useEffect(() => {
    if (!user) return;
    const requestsRef = collection(db, "users", user.uid, "friendRequests");
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      setFriendRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
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
      // Find user by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", text));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No user found with that email.");
        return;
      }

      const targetUserDoc = querySnapshot.docs[0];
      const targetUserId = targetUserDoc.id;

      // Prevent self-requests
      if (targetUserId === user.uid) {
        alert("You cannot send a request to yourself.");
        return;
      }

      // Check if request already exists
      const existingReq = query(
        collection(db, "users", targetUserId, "friendRequests"),
        where("fromId", "==", user.uid)
      );
      const existingSnapshot = await getDocs(existingReq);
      if (!existingSnapshot.empty) {
        alert("Friend request already sent.");
        return;
      }

      // Send the request
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
      // Add each other as friends
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

      // Remove the request
      await deleteDoc(doc(db, "users", user.uid, "friendRequests", req.id));
    } catch (e) {
      console.error("Error accepting request:", e);
    }
  };

  // 🔹 Reject friend request
  const rejectRequest = async (req) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "friendRequests", req.id));
    } catch (e) {
      console.error("Error rejecting request:", e);
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
                <span key={friend.id} className="friendList">
                  {friend.name || friend.friendEmail}
                </span>
              ))}
            </div>

            <h1 className="buttonlistTitle">Friend Requests:</h1>
            <div className="FriendRequests">
              {friendRequests.length === 0 && <p className="pendingRequests">No pending requests.</p>}
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
          </div>
        </div>
      )}
    </div>
  );
}
