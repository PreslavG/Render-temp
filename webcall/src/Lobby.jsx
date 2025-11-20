  import { useNavigate } from "react-router-dom";
  import { signOut } from "firebase/auth";
  import { auth, db, set } from "./scripts/firebase";
  import { useState, useEffect } from "react";
  import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    deleteDoc,
    getDocs,
    setDoc,
    query,
    where,
    getDoc,
  } from "firebase/firestore";

  import "./Lobby.css";

  function HourlyClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
      const tickInterval = setInterval(() => setTime(new Date()), 1000);

      
      const showHourlyMessage = () => {
        const current = new Date();
        const hour = current.getHours().toString().padStart(2, "0");
        alert(`🕒 It's now ${hour}:00!`);
      };

      const now = new Date();
      const msUntilNextHour =
        (60 - now.getMinutes()) * 60 * 1000 -
        now.getSeconds() * 1000 -
        now.getMilliseconds();

      const timeoutId = setTimeout(() => {
        showHourlyMessage();
        const hourlyInterval = setInterval(showHourlyMessage, 60 * 60 * 1000);
        return () => clearInterval(hourlyInterval);
      }, msUntilNextHour);

      return () => {
        clearTimeout(timeoutId);
        clearInterval(tickInterval);
      };
    }, []);

    const formattedTime = time.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return <div className="clock">{formattedTime}</div>;
  }



  export default function Lobby() {
    const navigate = useNavigate();
    const [isRoomPopupOpen, setIsRoomPopupOpen] = useState(false);
    const [isRoomListOpen, setIsRoomListOpen] = useState(false);
    const [isFriendsPopupOpen, setIsFriendsPopupOpen] = useState(false);
    const [isUserOptionsOpen, setIsUserOptionsPopupOpen] = useState(false);
    const [roomFullPopup, setRoomFullPopup] = useState(false);
    const [activeUsers, setActiveUsers] = useState({});
    const [activeUsersList, setActiveUsersList] = useState({});

    const [text, setText] = useState(""); 
    const [rooms, setRooms] = useState([]);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [roomInvites, setRoomInvites] = useState([]);
    const [activeTab, setActiveTab] = useState("rooms");

    const [selectedFriend, setSelectedFriend] = useState(null);
    const [selectedRoomId, setSelectedRoomId] = useState("");

    const [remainingSeconds, setRemainingSeconds] = useState(null);
    const [mode, setMode] = useState(null);
    const ACTIVE_THRESHOLD = 5000;

    const user = auth.currentUser;

    const handleLogout = async () => {
      try {
        await signOut(auth);
        navigate("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    };

    const joinRoom = async (room) => {
    const ownerId = room.adminId;
    const activeUsersRef = collection(db, "users", ownerId, "rooms", room.id, "activeUsers");
    const snapshot = await getDocs(activeUsersRef);

    const totalActive = snapshot.size;

    if (totalActive >= room.capacity) {
      alert("Room is full!");
      return;
    }

    await setDoc(doc(db, "users", ownerId,"rooms", room.id, "activeUsers", user.uid ), {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
    });

    navigate(`/room/${room.id}`, { state: { role: room.adminId === user.uid ? "admin" : "user" },ownerId: ownerId,});
  };

    useEffect(() => {
      if (!user) return;
      const roomsRef = collection(db, "users", user.uid, "rooms");
      const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
        const RoomData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRooms(RoomData);
      });
      return () => unsubscribe();
    }, [user]);

    useEffect(() => {
      if (!user) return;
      const friendsRef = collection(db, "users", user.uid, "friends");
      const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
        setFriends(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }, [user]);

    useEffect(() => {
      if (!user) return;
      const requestsRef = collection(db, "users", user.uid, "friendRequests");
      const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
        setFriendRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }, [user]);

    useEffect(() => {
      if (!user) return;
      const invitesRef = collection(db, "users", user.uid, "roomInvites");
      const unsubscribe = onSnapshot(invitesRef, (snapshot) => {
        setRoomInvites(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }, [user]);

          useEffect(() => {
            if (!selectedRoomId) return;
          const roomRef = doc(db,"users",user.uid ,"rooms", selectedRoomId);

          const unsubscribe = onSnapshot(roomRef, (snapshot) => {
            if (snapshot.exists()) return; 
              const data = snapshot.data();
              if (data.timer) {
              setMode(data.timer.mode);
              setRemainingSeconds(data.timer.remainingSeconds);
            
            }
          });

          return () => unsubscribe();
        }, [selectedRoomId]);

          useEffect(() => {
        if (!user) return;

        const unsubList = rooms.map(room => {
          console.log("Room debug:", room);
          if (!room.id || !room.adminId) return () => {};

          const activeUsersRef = collection(db, "users", room.adminId, "rooms", room.id, "activeUsers");

          const unsub = onSnapshot(activeUsersRef, snapshot => {
            const users = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            setActiveUsersList(prev => ({ ...prev, [room.id]: users }));
            setActiveUsers(prev => ({ ...prev, [room.id]: users.length }));
          });

          return unsub;
        });

        return () => unsubList.forEach(unsub => unsub());
      }, [rooms, user]);

    const roomAdd = async () => {
      if (!user || text.trim() === "") return;
      try {
        await addDoc(collection(db, "users", user.uid, "rooms"), {
          name: text,
          createdAt: new Date(),
          adminId: user.uid,
          adminEmail: user.email,
          capacity: 5,     
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
        await setDoc(doc(db, "users", user.uid, "rooms", invite.roomId), {
          name: invite.roomName,
          invitedBy: invite.fromEmail,
          adminId: invite.fromId,        // 🟢 КОЙ Е OWNER-а
          capacity: 5,                   // ако имаш capacity
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

    const getActiveUsers = (users) => {
          if (!users) return [];

          const now = Date.now();

          return users.filter(user => {
            if (!user.lastSeen) return true; 

            let lastSeenMs;

            if (user.lastSeen.toDate) {
              lastSeenMs = user.lastSeen.toDate().getTime();
            } else {
              lastSeenMs = new Date(user.lastSeen).getTime();
            }

            return now - lastSeenMs < ACTIVE_THRESHOLD;
          });
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
                  onClick={() =>{alert(activeUsers[room.id]),joinRoom(room)}}
                >
                {room.name} {room.adminId === user.uid && <span>👑</span>}
                    <h1 className="roomPplcount">
                        {activeUsers[room.id]}/{room.capacity}👤
                    </h1>
                            <ul className="activeUsersList">
                              {getActiveUsers(activeUsersList[room.id]).map((user) => (
                                <li key={user.email}>{user.name}</li>
                              ))}
                            </ul>
                          
                          
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

        {roomFullPopup && (
    <div className="popup-overlay">
      <div className="popup">
        <h2>🚫 Room is full!</h2>
        <p>This room has reached its maximum capacity.</p>
        <button onClick={() => setRoomFullPopup(false)}>Okay</button>
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
                {friendRequests.length === 0 && <p className="noPendMessages">No pending requests.</p>}
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
                {roomInvites.length === 0 && <p className="noPendMessages">No pending room invites.</p>}
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
