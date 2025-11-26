import React, { useState } from "react";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { useEffect } from "react";
import { storage } from "./scripts/firebase";
import "./File.css"; 

const categories = ["medicine", "mathematics", "language"];

export default function FileManager() {
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [filesList, setFilesList] = useState([]);

  const uploadFile = async () => {
    if (!file || !category) return alert("Select category & file first!");

    const fileRef = ref(storage, `files/${category}/${file.name}`);
    await uploadBytes(fileRef, file);
    await loadFiles();

    alert("Uploaded successfully!");
  };

  const loadFiles = async () => {
    if (!category) return alert("Choose a category!");

    const folderRef = ref(storage, `files/${category}/`);
    const items = await listAll(folderRef);

    const urls = await Promise.all(
      items.items.map(async (item) => ({
        name: item.name,
        url: await getDownloadURL(item),
      }))
    );

    setFilesList(urls);
  };

  const getFileIcon = (name, url) => {
    const ext = name.split(".").pop().toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

    if (isImage) return url;

    if (ext === "pdf")
      return "https://cdn-icons-png.flaticon.com/512/337/337946.png";

    if (["doc", "docx"].includes(ext))
      return "https://cdn-icons-png.flaticon.com/512/281/281760.png";

    if (["zip", "rar"].includes(ext))
      return "https://cdn-icons-png.flaticon.com/512/337/337947.png";

    if (["mp4", "mov"].includes(ext))
      return "https://cdn-icons-png.flaticon.com/512/727/727245.png";

    return "https://cdn-icons-png.flaticon.com/512/833/833524.png"; // default
  };

  useEffect(() => {
  if (category) {
    loadFiles();
  }
}, [category]);

  return (
    <div className="categoriesAndFiles">
      <h2 className="FMTitle"> File Manager</h2>
     <div className="categorySelect">
      <div className="category-list">
        <h1>Categories List:</h1>
        {categories.map((cat) => (
            <div
            key={cat}
            className={`category-item ${category === cat ? "active" : ""}`}
            onClick={() => {setCategory(cat)}}
            >
            {cat}
            </div>
        ))}
        </div>
        </div>

    <div className="ViewFiles">
      <h3>Files in {category}</h3>

      {filesList.length === 0 && <p>No files here yet.</p>}

      <div className="file-grid">
        {filesList.map((file, index) => (
          <div className="file-item" key={index}>
            <img
              src={getFileIcon(file.name, file.url)}
              alt={file.name}
              className="file-thumb"
              onClick={() => window.open(file.url, "_blank")}
            />

            <p className="file-name">{file.name}</p>

          </div>
          
        ))}
        <div className="upload">
        <input type="file" onChange={(e) => setFile(e.target.files[0])} 
        key={file ? file.name : "empty"}/>
        <button onClick={uploadFile}>Upload</button>
        </div>
        </div>
      </div>
    </div>
  );
}
