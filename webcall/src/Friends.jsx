import { useState, useEffect } from "react";
import { auth, db } from "./scripts/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, query, where, getDocs,setDoc, getDoc, doc} from "firebase/firestore";
import "./Friends.css"
import { FaUserFriends } from "react-icons/fa";


export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [isFriendsPopupOpen, setIsFriendsPopupOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [isRoomListOpen, setIsRoomListOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [profilePic,setProfilePic] = useState(null);

  const [activeTab, setActiveTab] = useState("friends");





  const [roomInvites, setRoomInvites] = useState([]);

  const [text, setText] = useState("");
  const user = auth.currentUser;


 useEffect(() => {
  if (!user) return;

  const friendsRef = collection(db, "users", user.uid, "friends");

  const unsubscribe = onSnapshot(friendsRef, async (snapshot) => {
    const friendsData = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const friend = docSnap.data();
        const friendDoc = await getDoc(doc(db, "users", friend.friendId));

        return {
          id: docSnap.id,
          ...friend,
          profilePic: friendDoc.exists() ? friendDoc.data().profilePic : null, 
        };
      })
    );

    setFriends(friendsData);
  });

  return unsubscribe;
}, [user]);

  useEffect(() => {
    if (!user) return;
    const requestsRef = collection(db, "users", user.uid, "friendRequests");
    const unsubscribe = onSnapshot(requestsRef, snapshot => {
      setFriendRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
      if (!user) return;
      const roomsRef = collection(db, "users", user.uid, "rooms");
      const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
        const RoomData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRooms(RoomData);
      });
      return () => unsubscribe();
    }, [user]);

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
       const setUrl = async () => {
          try {
            const docRef = doc(db, "users", auth.currentUser.uid);
            const snap = await getDoc(docRef);
      
            if (snap.exists()) {
              const profilePic = snap.data().profilePic;
              setProfilePic(profilePic);
              return profilePic;
            } else {
              console.log("Document does not exist");
              return null;
            }
          } catch (error) {
            console.error("Error fetching user document:", error);
          }
        };
      
        useEffect(() => {
          setUrl();
        });

  const rejectRequest = async (req) => {
        try {
          await deleteDoc(doc(db, "users", user.uid, "friendRequests", req.id));
        } catch (e) {
          console.error("Error rejecting request:", e);
        }
      };

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
              useEffect(() => {
      if (!user) return;
      const invitesRef = collection(db, "users", user.uid, "roomInvites");
      const unsubscribe = onSnapshot(invitesRef, (snapshot) => {
        setRoomInvites(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
      return unsubscribe;
    }, [user]);

  return (
           <div className="friendsPage">
            <div className="Friends">
              <div className="friendsElements">
              <h1
                className={`tab ${activeTab === "friends" ? "activeTab" : ""}`}
                onClick={() => setActiveTab("friends")}
              >
                Friends
              </h1>

              <h1
                className={`tab ${activeTab === "requests" ? "activeTab" : ""}`}
                onClick={() => setActiveTab("requests")}
              >
                Friend Requests
              </h1>

              <h1
                className={`tab ${activeTab === "invites" ? "activeTab" : ""}`}
                onClick={() => setActiveTab("invites")}
              >
                Room Invites
              </h1>
              </div>
                    {activeTab === "friends" && (
                   <div className="frElementSecond">
                    <div className="UserFriends">
                      <div className="FriendListsGrid">
                      {friends.length === 0 && <p className="noPendMessages">No friends yet.</p>}
                      {friends.map((friend) => (
                        <button
                          key={friend.id}
                          className="friendList"
                          onClick={() => {
                              setSelectedFriend(friend);
                              setIsRoomListOpen(true);
                          }}
                          >
                          <div className="friendItem">
                              
                              <img
                              src={friend.profilePic || "./images/default-avatar.jpg"} 
                              alt={friend.name || friend.friendEmail}
                              id="friendPic"
                              />
                            
                          </div>
                          <span id="friendName">{friend.name || friend.friendEmail}</span>
                          </button>
                          
                          
                      ))}
                      </div>
                      
                     </div>
                      <button className="AddFriends" onClick={() => setIsFriendsPopupOpen(true)}>
                        Add Friend +
                      </button>
                </div>
                
                    )}


              
           
             {activeTab === "requests" && (
                <div className="frElementSecond">
              <div className="FriendRequests">
                {friendRequests.length === 0 && <p className="noPendMessages">No pending requests.</p>}
                {friendRequests.map((req) => (
                  <div key={req.id} className="friendRequestItem">
                    <img
                              src={req.profilePic || "./images/default-avatar.jpg"} 
                              alt={req.name || req.friendEmail}
                              id="friendreqPic"
                     />
                    <div className="temp">
                    <span id="nameAndEmail">
                      <h1>{req.fromName}</h1>
                      <h2>{req.fromEmail}</h2>
                    </span>
                    <div className="reqButtons">
                      <button id="requestButtonAccept" onClick={() => acceptRequest(req)}>Confirm</button>
                      <button id="requestButtonDeny" onClick={() => rejectRequest(req)}>Delete</button>
                    </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
             )}
             {activeTab === "invites" && (
                <div className="frElementSecond">
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
             )}

          {isFriendsPopupOpen && (
          <div className="popup-overlay">
            <div className="popup">
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
        {isRoomListOpen && selectedFriend && (
          <div className="popup-overlay">
            <div className="popup">
              <h3>Invite {selectedFriend.name} to join your room?</h3>
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
              <div className="inviteFrBtns">
                <button className="singleBtn" onClick={sendRoomInvite}> <FaUserFriends /> Send Invite</button>
                <button className="singleBtn" onClick={() => setIsRoomListOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
            </div>
            </div>

          
  )
}
