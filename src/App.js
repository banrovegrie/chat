import './App.css';

import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import { BrowserRouter, Switch, Route, Redirect } from "react-router-dom";
import { useParams } from 'react-router'
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { useState, useRef } from 'react';
import "firebase/storage"

firebase.initializeApp({
  apiKey: "AIzaSyB8-sBMzZuajjo2DqXOicRKInxvhGUZXE4",
  authDomain: "canswerchat.firebaseapp.com",
  projectId: "canswerchat",
  storageBucket: "canswerchat.appspot.com",
  messagingSenderId: "864746319554",
  appId: "1:864746319554:web:97070900dd3fd0ca15555b"
})

const firestore = firebase.firestore();

function GroupChat() {
  //this dummy variable is for autoscroll to bottom when new message is sent. 
  //ideally it should be working when the chat is loaded for the first time as well - it does work in the video
  //but i must have messed up somewhere.
  const dummy = useRef()
  let { id } = useParams();


  const messagesRef = firestore.collection('groupMessages');
  const query = messagesRef.orderBy('createdAt').limit(500);

  const [messages] = useCollectionData(query, { idField: 'id' });

  const [formValue, setFormValue] = useState('');

  const sendMessage = async (e, email) => {
    e.preventDefault();
    await messagesRef.add({
      text: formValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      sender: id
    })

    setFormValue('');
    dummy.current.scrollIntoView({ behaviour: 'smooth' });
  }

  return (
    <div className="Main" style={{height: "100vh"}}>
      <main>
        {messages && messages.map(msg => <GroupChatMessage email={id} key={msg.id} message={msg} />)}
        <span ref={dummy}></span>
      </main>
      <form onSubmit={sendMessage}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder=" Message" />
        <button type="submit" disabled={!formValue}>Send</button>
      </form>
    </div>
  )

}

function GroupChatMessage(props) {

  const { text, sender, createdAt, uid } = props.message;

  //this is conditional css.
  const messageClass = sender === props.email ? 'sent' : 'received';

  if (messageClass === "received")
    return (
      <div className={`message ${messageClass}`}>
        <p>{text}, <i>sent by {sender}</i></p>
      </div>
    )
  else
    return (
      <div className={`message ${messageClass}`}>
        <p>{text}</p>
      </div>
    )
}

function PrivateChat(props) {
  //purpose of dummy same as in group chat. please check there.
  const dummy = useRef()
  const { id, pid } = useParams();

  //storeRef is for Cloud Storage - for file upload.
  const storeRef = firebase.storage().ref();

  //filtered by patient pid. Note, in case you wish to change database to your own firebase,
  //then the below query won't work.
  //this is because firestore doesn't allow multiple query parameters on different fields (over here, it is patient and createdAt)
  //so indexing has to be done in firestore.
  const messagesRef = firestore.collection('privateMessages');
  const query = messagesRef.where('patient', '==', pid).orderBy('createdAt').limit(500);

  const [messages] = useCollectionData(query, { idField: 'id' });

  //messageType is to know if user is uploading file or sending text. 1 -> sending text, 0 -> sending file.
  const [messageType, setMessageType] = useState(1);
  const [formValue, setFormValue] = useState('');


  //this is only for text message, same as group chat
  //the tofrom is a database field to know if patient is the one who sent or care provider - just like in adalo database.
  const sendMessage = async (e, email) => {
    let tofrom = 1
    if (id === "admin@canswer.com")
      tofrom = 0

    e.preventDefault();

    await messagesRef.add({
      text: formValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      patient: pid,
      toFrom: tofrom,
      file: 0,
      filename: "",
      url: ""
    })

    setFormValue('');
    dummy.current.scrollIntoView({ behaviour: 'smooth' });
  }


  //switch between text or file
  function changetype() {
    if (messageType === 1)
      setMessageType(0)
    else
      setMessageType(1)
  }

  //fileUpload function
  const fileUpload = async (e) => {
    let f = e.target.files[0];
    let tofrom = 1
    if (id === "admin@canswer.com")
      tofrom = 0

    //furl is a variable to store the url of the file once it is uploaded
    let furl = ""
    let ref = storeRef.child(f.name);

    //this is file upload section
    ref.put(f).then(async () => {
      await storeRef.child(f.name).getDownloadURL(f.name).then((url) => {
        furl = url;
      })

      //this is to make an entry in firestore
      //that stores the url in 'furl'
      //it displays an <a> tag in chat
      //the file field is set as 1 to indicate this message is file.
      //check PrivateChatMessage for further details
      await messagesRef.add({
        text: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        patient: pid,
        toFrom: tofrom,
        file: 1,
        filename: f.name,
        url: furl
      })
    })
  }

  if (messageType === 1) {
    return (
      <div className="Main">
        <main>
          {messages && messages.map(msg => <PrivateChatMessage email={id} key={msg.id} message={msg} />)}
          <span ref={dummy}></span>
        </main>
        <div className='form'>
          <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder=" Message" />
          <button className='form-button' onClick={changetype}>upload</button>
          <button className='form-button' onClick={sendMessage} disabled={!formValue}>Send</button>
        </div>
      </div>
    )
  }
  else {
    return (
      <div className="Main">
        <main>
          {messages && messages.map(msg => <PrivateChatMessage email={id} key={msg.id} message={msg} />)}
          <span ref={dummy}></span>
        </main>
        <div className='form'>
          <input type='file' onChange={(e) => fileUpload(e)}></input>
          <button className='form-button' onClick={changetype}>text</button>
        </div>
      </div>
    )
  }
}

function PrivateChatMessage(props) {
  const { text, patient, toFrom, file, url, filename, id } = props.message;

  let messageClass

  if ((toFrom === 0 && props.email === "admin@canswer.com") || (toFrom === 1 && props.email === patient)) {
    messageClass = 'sent'
  }
  else {
    messageClass = 'received';
  }

  //if simple text, just display p tag
  if (file === 0) {
    return (
      <div className={`message ${messageClass}`}>
        <p>{text}</p>
      </div>
    )
  }
  //else, display an anchor tag
  else {
    return (
      <div className={`message ${messageClass}`}>
        <a href={url}>{filename}</a>
      </div>
    )
  }
}

//in the route for privatechat, the reason why id as well as pid is needed:
//the pid specifies to whom the private chat is. the id specifies who is sending to this chat - whether the patient, or the care provider.
function App() {
  return (
    <div className="App">
      <header>
      </header>
      <section>
        <BrowserRouter>
          <Switch>
            <Route path="/groupchat/:id" component={GroupChat} exact />
            <Route path="/privatechat/:id/:pid" component={PrivateChat} exact />
          </Switch>
        </BrowserRouter>
      </section>
    </div>
  );
}

export default App;
